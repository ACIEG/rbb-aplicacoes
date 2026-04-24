// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title Interface pública do Selo Digital de Associado da ACIEG
/// @notice Expõe apenas as funções que terceiros (bancos, órgãos públicos, fornecedores)
///         utilizam para verificar se uma entidade é associada ativa da ACIEG.
interface ISelo {
    struct DadosAssociado {
        string cnpjOuCpf;
        string razaoSocial;
        string setor;
        uint256 emitidoEm;
        uint256 validoAte;
        bool revogado;
        string motivoRevogacao;
    }

    /// @notice Retorna `true` se o endereço possui selo ativo (não revogado e dentro da validade).
    function statusAtivo(address associado) external view returns (bool);

    /// @notice Retorna os dados completos do selo emitido para um endereço.
    function dadosAssociado(address associado) external view returns (DadosAssociado memory);

    /// @notice Retorna `true` se o CNPJ/CPF informado corresponde a um selo ativo.
    function verificarPorCnpj(string calldata cnpjOuCpf) external view returns (bool);

    /// @notice Retorna o endereço do portador de um CNPJ/CPF, ou address(0) se inexistente.
    function associadoPorCnpj(string calldata cnpjOuCpf) external view returns (address);
}
