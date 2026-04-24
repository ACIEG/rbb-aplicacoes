// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {RastreabilidadeLote} from "./RastreabilidadeLote.sol";

/// @title Certificados de Conformidade para Lotes Rastreáveis
/// @notice Instituições certificadoras (FSC, IBD, EUDR, Selo Inmetro) emitem certificados
///         de conformidade para lotes, referenciando o token de Rastreabilidade.
///         Um compradores europeu, por exemplo, consulta se o lote tem certificado EUDR
///         válido antes de aceitar a carga.
contract CertificadosConformidade is AccessControl {
    enum TipoCertificado {
        NAO_DEFINIDO,
        EUDR,              // Regulamento Europeu Anti-Desmatamento
        ESG,               // Environmental, Social, Governance
        ORGANICO,
        GMO_FREE,
        FAIR_TRADE,
        OUTRO
    }

    struct Certificado {
        uint256 loteTokenId;
        TipoCertificado tipo;
        address emissor;       // Endereço da certificadora
        string nomeEmissor;    // Nome amigável ex: "IBD Certificações"
        uint256 emitidoEm;
        uint256 validoAte;
        bytes32 hashDocumento; // Hash do PDF do certificado emitido off-chain
        string observacao;
        bool revogado;
    }

    bytes32 public constant CERTIFICADORA_ROLE = keccak256("CERTIFICADORA_ROLE");

    RastreabilidadeLote public immutable lotes;
    uint256 private _proximoId;

    mapping(uint256 certId => Certificado) private _certificados;
    mapping(uint256 loteTokenId => uint256[] certIds) private _certificadosDoLote;

    event CertificadoEmitido(
        uint256 indexed certId,
        uint256 indexed loteTokenId,
        TipoCertificado indexed tipo,
        address emissor,
        uint256 validoAte
    );
    event CertificadoRevogado(uint256 indexed certId, string motivo);

    error TipoInvalido();
    error LoteInexistente(uint256 loteTokenId);
    error ValidadeDeveSerFutura();
    error HashObrigatorio();
    error CertificadoInexistente(uint256 certId);
    error JaRevogado(uint256 certId);

    constructor(address admin, address lotesAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        lotes = RastreabilidadeLote(lotesAddress);
    }

    /// @notice Certificadora emite certificado para um lote. Requer CERTIFICADORA_ROLE.
    function emitir(
        uint256 loteTokenId,
        TipoCertificado tipo,
        string calldata nomeEmissor,
        uint256 validoAte,
        bytes32 hashDocumento,
        string calldata observacao
    ) external onlyRole(CERTIFICADORA_ROLE) returns (uint256 certId) {
        if (tipo == TipoCertificado.NAO_DEFINIDO) revert TipoInvalido();
        if (validoAte <= block.timestamp) revert ValidadeDeveSerFutura();
        if (hashDocumento == bytes32(0)) revert HashObrigatorio();
        // Valida existência do lote consultando ownerOf (reverte ERC721NonexistentToken se não existir)
        try lotes.ownerOf(loteTokenId) returns (address) {
            // lote existe
        } catch {
            revert LoteInexistente(loteTokenId);
        }

        unchecked {
            certId = ++_proximoId;
        }

        _certificados[certId] = Certificado({
            loteTokenId: loteTokenId,
            tipo: tipo,
            emissor: msg.sender,
            nomeEmissor: nomeEmissor,
            emitidoEm: block.timestamp,
            validoAte: validoAte,
            hashDocumento: hashDocumento,
            observacao: observacao,
            revogado: false
        });
        _certificadosDoLote[loteTokenId].push(certId);

        emit CertificadoEmitido(certId, loteTokenId, tipo, msg.sender, validoAte);
    }

    function revogar(uint256 certId, string calldata motivo) external onlyRole(CERTIFICADORA_ROLE) {
        if (_certificados[certId].emissor == address(0)) revert CertificadoInexistente(certId);
        if (_certificados[certId].revogado) revert JaRevogado(certId);
        _certificados[certId].revogado = true;
        _certificados[certId].observacao = motivo;
        emit CertificadoRevogado(certId, motivo);
    }

    function detalhes(uint256 certId) external view returns (Certificado memory) {
        if (_certificados[certId].emissor == address(0)) revert CertificadoInexistente(certId);
        return _certificados[certId];
    }

    function certificadosDoLote(uint256 loteTokenId) external view returns (uint256[] memory) {
        return _certificadosDoLote[loteTokenId];
    }

    function temCertificadoValido(uint256 loteTokenId, TipoCertificado tipo)
        external
        view
        returns (bool)
    {
        uint256[] memory ids = _certificadosDoLote[loteTokenId];
        for (uint256 i = 0; i < ids.length; i++) {
            Certificado storage c = _certificados[ids[i]];
            if (
                c.tipo == tipo &&
                !c.revogado &&
                block.timestamp <= c.validoAte
            ) {
                return true;
            }
        }
        return false;
    }
}
