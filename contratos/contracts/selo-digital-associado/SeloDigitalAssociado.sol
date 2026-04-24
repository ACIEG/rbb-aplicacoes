// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ISelo} from "./interfaces/ISelo.sol";

/// @title Selo Digital de Associado ACIEG — SBT (Soulbound Token)
/// @notice Cartão digital on-chain emitido pela ACIEG aos seus associados.
///         Terceiros (bancos, órgãos públicos, fornecedores) consultam `statusAtivo` ou
///         `verificarPorCnpj` para confirmar vínculo em tempo real, sem papel.
///         O token é **soulbound**: transferências são revertidas. Apenas mint e burn
///         (emissão e revogação) são permitidos.
/// @dev Arquitetura soulbound via override de `_update` bloqueando transferências.
contract SeloDigitalAssociado is ERC721, AccessControl, ISelo {
    using Strings for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REVOGADOR_ROLE = keccak256("REVOGADOR_ROLE");

    uint256 private _proximoId;

    mapping(uint256 tokenId => DadosAssociado) private _dados;
    mapping(address associado => uint256 tokenId) private _tokenDe;
    mapping(bytes32 cnpjHash => uint256 tokenId) private _tokenPorCnpj;

    event SeloEmitido(
        uint256 indexed tokenId,
        address indexed associado,
        string cnpjOuCpf,
        string razaoSocial,
        uint256 validoAte
    );
    event SeloRevogado(uint256 indexed tokenId, address indexed associado, string motivo);

    error SeloIntransferivel();
    error AssociadoJaPossuiSelo(address associado);
    error CnpjJaRegistrado(string cnpjOuCpf);
    error SeloInexistente(address associado);
    error CnpjObrigatorio();
    error RazaoSocialObrigatoria();
    error ValidadeDeveSerFutura();
    error SeloJaRevogado(uint256 tokenId);

    constructor(address admin)
        ERC721(unicode"Selo Digital de Associado ACIEG", "SELO-ACIEG")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(REVOGADOR_ROLE, admin);
    }

    // ========= Operações administrativas =========

    /// @notice Emite um novo selo para um associado. Apenas ADMIN_ROLE.
    /// @dev Reverte se o associado já tiver selo ou se o CNPJ já estiver registrado.
    /// @param associado Endereço da carteira do associado (pessoa jurídica ou física).
    /// @param cnpjOuCpf CNPJ (formato 14 dígitos) ou CPF (11 dígitos), somente números.
    /// @param razaoSocial Nome ou razão social do associado.
    /// @param setor Setor de atuação (ex: "Comércio", "Indústria", "Serviços").
    /// @param validoAte Timestamp UNIX até quando o selo é válido.
    /// @return tokenId Identificador único do selo emitido.
    function emitir(
        address associado,
        string calldata cnpjOuCpf,
        string calldata razaoSocial,
        string calldata setor,
        uint256 validoAte
    ) external onlyRole(ADMIN_ROLE) returns (uint256 tokenId) {
        if (bytes(cnpjOuCpf).length == 0) revert CnpjObrigatorio();
        if (bytes(razaoSocial).length == 0) revert RazaoSocialObrigatoria();
        if (validoAte <= block.timestamp) revert ValidadeDeveSerFutura();
        if (_tokenDe[associado] != 0) revert AssociadoJaPossuiSelo(associado);

        bytes32 cnpjHash = keccak256(bytes(cnpjOuCpf));
        if (_tokenPorCnpj[cnpjHash] != 0) revert CnpjJaRegistrado(cnpjOuCpf);

        unchecked {
            tokenId = ++_proximoId;
        }

        _dados[tokenId] = DadosAssociado({
            cnpjOuCpf: cnpjOuCpf,
            razaoSocial: razaoSocial,
            setor: setor,
            emitidoEm: block.timestamp,
            validoAte: validoAte,
            revogado: false,
            motivoRevogacao: ""
        });
        _tokenDe[associado] = tokenId;
        _tokenPorCnpj[cnpjHash] = tokenId;

        _safeMint(associado, tokenId);

        emit SeloEmitido(tokenId, associado, cnpjOuCpf, razaoSocial, validoAte);
    }

    /// @notice Revoga um selo. Apenas REVOGADOR_ROLE.
    /// @param tokenId Identificador do selo a ser revogado.
    /// @param motivo Motivo da revogação (ex: "Inadimplência", "Desligamento").
    function revogar(uint256 tokenId, string calldata motivo) external onlyRole(REVOGADOR_ROLE) {
        _requireOwned(tokenId);
        DadosAssociado storage d = _dados[tokenId];
        if (d.revogado) revert SeloJaRevogado(tokenId);
        d.revogado = true;
        d.motivoRevogacao = motivo;
        emit SeloRevogado(tokenId, _ownerOf(tokenId), motivo);
    }

    // ========= Consultas públicas (ISelo) =========

    function statusAtivo(address associado) external view returns (bool) {
        uint256 tokenId = _tokenDe[associado];
        if (tokenId == 0) return false;
        DadosAssociado storage d = _dados[tokenId];
        if (d.revogado) return false;
        if (block.timestamp > d.validoAte) return false;
        return true;
    }

    function dadosAssociado(address associado) external view returns (DadosAssociado memory) {
        uint256 tokenId = _tokenDe[associado];
        if (tokenId == 0) revert SeloInexistente(associado);
        return _dados[tokenId];
    }

    function verificarPorCnpj(string calldata cnpjOuCpf) external view returns (bool) {
        uint256 tokenId = _tokenPorCnpj[keccak256(bytes(cnpjOuCpf))];
        if (tokenId == 0) return false;
        DadosAssociado storage d = _dados[tokenId];
        if (d.revogado) return false;
        if (block.timestamp > d.validoAte) return false;
        return true;
    }

    function associadoPorCnpj(string calldata cnpjOuCpf) external view returns (address) {
        uint256 tokenId = _tokenPorCnpj[keccak256(bytes(cnpjOuCpf))];
        if (tokenId == 0) return address(0);
        return _ownerOf(tokenId);
    }

    /// @notice tokenURI retorna um JSON data URI com metadados on-chain (ERC-721 Metadata).
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        DadosAssociado storage d = _dados[tokenId];

        string memory status = d.revogado
            ? "Revogado"
            : block.timestamp > d.validoAte ? "Expirado" : "Ativo";

        bytes memory json = abi.encodePacked(
            '{"name":"Selo ACIEG #',
            tokenId.toString(),
            '","description":"Selo Digital de Associado ACIEG (soulbound, emitido na Rede Blockchain Brasil).",',
            '"attributes":[',
            '{"trait_type":"CNPJ/CPF","value":"', d.cnpjOuCpf, '"},',
            '{"trait_type":"Razao Social","value":"', d.razaoSocial, '"},',
            '{"trait_type":"Setor","value":"', d.setor, '"},',
            '{"trait_type":"Status","value":"', status, '"},',
            '{"trait_type":"Emitido em","display_type":"date","value":', d.emitidoEm.toString(), '},',
            '{"trait_type":"Valido ate","display_type":"date","value":', d.validoAte.toString(), '}',
            "]}"
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    // ========= Soulbound =========

    /// @dev Bloqueia qualquer transferência. Permite apenas mint (from == 0) e burn (to == 0).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SeloIntransferivel();
        return super._update(to, tokenId, auth);
    }

    // ========= ERC-165 =========

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
