// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ICertificado} from "./interfaces/ICertificado.sol";

/// @title Certificado de Capacitação Verificável ACIEG — SBT
/// @notice Certificado de curso/workshop/programa registrado on-chain com hash SHA-256
///         do PDF original, permitindo qualquer empregador ou terceiro confirmar
///         autenticidade sem contactar a ACIEG.
/// @dev Soulbound — certificado fica permanentemente vinculado ao aluno que concluiu.
contract CertificadoCapacitacao is ERC721, AccessControl, ICertificado {
    using Strings for uint256;

    bytes32 public constant EMISSOR_ROLE = keccak256("EMISSOR_ROLE");
    bytes32 public constant REVOGADOR_ROLE = keccak256("REVOGADOR_ROLE");

    uint256 private _proximoId;

    mapping(uint256 tokenId => Certificado) private _certificados;
    mapping(bytes32 hashPdf => uint256 tokenId) private _tokenPorHash;
    mapping(address aluno => uint256[] tokenIds) private _certificadosDoAluno;

    event CertificadoEmitido(
        uint256 indexed tokenId,
        address indexed aluno,
        address indexed emissor,
        bytes32 hashPdf,
        string nomeCurso,
        uint256 cargaHorariaHoras
    );
    event CertificadoRevogado(uint256 indexed tokenId, address indexed aluno, string motivo);

    error CertificadoIntransferivel();
    error HashDuplicado(bytes32 hashPdf);
    error HashObrigatorio();
    error NomeCursoObrigatorio();
    error NomeAlunoObrigatorio();
    error CargaHorariaInvalida();
    error CertificadoJaRevogado(uint256 tokenId);

    constructor(address admin)
        ERC721(unicode"Certificado de Capacitação ACIEG", "CERT-ACIEG")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EMISSOR_ROLE, admin);
        _grantRole(REVOGADOR_ROLE, admin);
    }

    // ========= Operações administrativas =========

    /// @notice Emite um certificado para um aluno concluinte.
    /// @dev O `hashPdf` é o SHA-256 (bytes32) do PDF original do certificado. Isso garante
    ///      que qualquer PDF em poder do empregador pode ser verificado: se o SHA-256 do
    ///      arquivo bate com o hash on-chain, o certificado é autêntico.
    function emitirCertificado(
        address aluno,
        bytes32 hashPdf,
        string calldata nomeCurso,
        string calldata nomeAluno,
        uint256 cargaHorariaHoras,
        uint256 dataConclusao
    ) external onlyRole(EMISSOR_ROLE) returns (uint256 tokenId) {
        if (hashPdf == bytes32(0)) revert HashObrigatorio();
        if (bytes(nomeCurso).length == 0) revert NomeCursoObrigatorio();
        if (bytes(nomeAluno).length == 0) revert NomeAlunoObrigatorio();
        if (cargaHorariaHoras == 0) revert CargaHorariaInvalida();
        if (_tokenPorHash[hashPdf] != 0) revert HashDuplicado(hashPdf);

        unchecked {
            tokenId = ++_proximoId;
        }

        _certificados[tokenId] = Certificado({
            hashPdf: hashPdf,
            nomeCurso: nomeCurso,
            nomeAluno: nomeAluno,
            cargaHorariaHoras: cargaHorariaHoras,
            dataConclusao: dataConclusao,
            emissor: msg.sender,
            revogado: false,
            motivoRevogacao: ""
        });
        _tokenPorHash[hashPdf] = tokenId;
        _certificadosDoAluno[aluno].push(tokenId);

        _safeMint(aluno, tokenId);

        emit CertificadoEmitido(
            tokenId,
            aluno,
            msg.sender,
            hashPdf,
            nomeCurso,
            cargaHorariaHoras
        );
    }

    /// @notice Revoga um certificado (ex: curso cancelado, identidade fraudada).
    function revogar(uint256 tokenId, string calldata motivo) external onlyRole(REVOGADOR_ROLE) {
        _requireOwned(tokenId);
        Certificado storage c = _certificados[tokenId];
        if (c.revogado) revert CertificadoJaRevogado(tokenId);
        c.revogado = true;
        c.motivoRevogacao = motivo;
        emit CertificadoRevogado(tokenId, _ownerOf(tokenId), motivo);
    }

    // ========= Consultas públicas (ICertificado) =========

    function detalhes(uint256 tokenId) external view returns (Certificado memory) {
        _requireOwned(tokenId);
        return _certificados[tokenId];
    }

    function verificarPorHash(bytes32 hashPdf) external view returns (bool valido, uint256 tokenId) {
        tokenId = _tokenPorHash[hashPdf];
        if (tokenId == 0) return (false, 0);
        valido = !_certificados[tokenId].revogado;
    }

    function certificadosDe(address aluno) external view returns (uint256[] memory) {
        return _certificadosDoAluno[aluno];
    }

    /// @notice tokenURI retorna um JSON data URI com metadados on-chain (ERC-721 Metadata).
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Certificado storage c = _certificados[tokenId];

        bytes memory json = abi.encodePacked(
            '{"name":"Certificado ACIEG #',
            tokenId.toString(),
            unicode'","description":"Certificado de Capacitacao ACIEG emitido na Rede Blockchain Brasil. Hash SHA-256 do PDF original gravado on-chain para verificacao de autenticidade.",',
            '"attributes":[',
            '{"trait_type":"Curso","value":"', c.nomeCurso, '"},',
            '{"trait_type":"Aluno","value":"', c.nomeAluno, '"},',
            '{"trait_type":"Carga Horaria (h)","value":', c.cargaHorariaHoras.toString(), "},",
            '{"trait_type":"Data Conclusao","display_type":"date","value":', c.dataConclusao.toString(), "},",
            '{"trait_type":"Hash PDF","value":"', _toHex(c.hashPdf), '"},',
            '{"trait_type":"Status","value":"', c.revogado ? "Revogado" : "Valido", '"}',
            "]}"
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _toHex(bytes32 data) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    // ========= Soulbound =========

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert CertificadoIntransferivel();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
