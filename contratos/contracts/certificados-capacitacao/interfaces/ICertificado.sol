// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title Interface pública dos Certificados de Capacitação ACIEG
/// @notice Expõe apenas as funções de verificação que empregadores e terceiros utilizam
///         para confirmar a autenticidade de um certificado emitido pela ACIEG.
interface ICertificado {
    struct Certificado {
        bytes32 hashPdf;
        string nomeCurso;
        string nomeAluno;
        uint256 cargaHorariaHoras;
        uint256 dataConclusao;
        address emissor;
        bool revogado;
        string motivoRevogacao;
    }

    /// @notice Retorna detalhes de um certificado pelo tokenId.
    function detalhes(uint256 tokenId) external view returns (Certificado memory);

    /// @notice Verifica se um hash SHA-256 de PDF corresponde a certificado ativo.
    function verificarPorHash(bytes32 hashPdf) external view returns (bool valido, uint256 tokenId);

    /// @notice Retorna todos os tokenIds de certificados emitidos para um aluno.
    function certificadosDe(address aluno) external view returns (uint256[] memory);
}
