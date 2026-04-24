// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Registro de Produtores Goianos
/// @notice Cadastro de produtores (agropecuária, mineração, indústria) elegíveis a emitir
///         lotes rastreáveis no programa "Feito em Goiás". Controlado por um ou mais
///         CADASTRADORES (ex: ACIEG, federações setoriais, órgãos estaduais).
contract RegistroProdutores is AccessControl {
    enum Setor {
        NAO_DEFINIDO,
        AGROPECUARIA,
        MINERACAO,
        INDUSTRIA
    }

    struct Produtor {
        string cnpjOuCpf;
        string nome;
        string car;           // Cadastro Ambiental Rural (para agropecuária; opcional)
        string municipio;     // ex: "Rio Verde/GO"
        int256 latitudeE6;    // latitude * 1e6 (int para permitir negativo)
        int256 longitudeE6;   // longitude * 1e6
        Setor setor;
        bool ativo;
        uint256 cadastradoEm;
    }

    bytes32 public constant CADASTRADOR_ROLE = keccak256("CADASTRADOR_ROLE");

    mapping(address produtor => Produtor) private _produtores;
    mapping(bytes32 cnpjHash => address produtor) private _enderecoPorCnpj;
    address[] private _todos;

    event ProdutorCadastrado(
        address indexed produtor,
        string cnpjOuCpf,
        string nome,
        Setor setor,
        string municipio
    );
    event CARAtualizado(address indexed produtor, string novoCar);
    event ProdutorSuspenso(address indexed produtor, string motivo);
    event ProdutorReativado(address indexed produtor);

    error ProdutorJaCadastrado(address produtor);
    error CnpjJaRegistrado(string cnpjOuCpf);
    error ProdutorInexistente(address produtor);
    error CnpjObrigatorio();
    error NomeObrigatorio();
    error SetorInvalido();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CADASTRADOR_ROLE, admin);
    }

    function cadastrar(
        address produtor,
        string calldata cnpjOuCpf,
        string calldata nome,
        string calldata car,
        string calldata municipio,
        int256 latitudeE6,
        int256 longitudeE6,
        Setor setor
    ) external onlyRole(CADASTRADOR_ROLE) {
        if (bytes(cnpjOuCpf).length == 0) revert CnpjObrigatorio();
        if (bytes(nome).length == 0) revert NomeObrigatorio();
        if (setor == Setor.NAO_DEFINIDO) revert SetorInvalido();
        if (_produtores[produtor].cadastradoEm != 0) revert ProdutorJaCadastrado(produtor);

        bytes32 cnpjHash = keccak256(bytes(cnpjOuCpf));
        if (_enderecoPorCnpj[cnpjHash] != address(0)) revert CnpjJaRegistrado(cnpjOuCpf);

        _produtores[produtor] = Produtor({
            cnpjOuCpf: cnpjOuCpf,
            nome: nome,
            car: car,
            municipio: municipio,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            setor: setor,
            ativo: true,
            cadastradoEm: block.timestamp
        });
        _enderecoPorCnpj[cnpjHash] = produtor;
        _todos.push(produtor);

        emit ProdutorCadastrado(produtor, cnpjOuCpf, nome, setor, municipio);
    }

    function atualizarCAR(address produtor, string calldata novoCar)
        external
        onlyRole(CADASTRADOR_ROLE)
    {
        if (_produtores[produtor].cadastradoEm == 0) revert ProdutorInexistente(produtor);
        _produtores[produtor].car = novoCar;
        emit CARAtualizado(produtor, novoCar);
    }

    function suspender(address produtor, string calldata motivo)
        external
        onlyRole(CADASTRADOR_ROLE)
    {
        if (_produtores[produtor].cadastradoEm == 0) revert ProdutorInexistente(produtor);
        _produtores[produtor].ativo = false;
        emit ProdutorSuspenso(produtor, motivo);
    }

    function reativar(address produtor) external onlyRole(CADASTRADOR_ROLE) {
        if (_produtores[produtor].cadastradoEm == 0) revert ProdutorInexistente(produtor);
        _produtores[produtor].ativo = true;
        emit ProdutorReativado(produtor);
    }

    function produtorAtivo(address produtor) external view returns (bool) {
        return _produtores[produtor].ativo;
    }

    function dadosProdutor(address produtor) external view returns (Produtor memory) {
        if (_produtores[produtor].cadastradoEm == 0) revert ProdutorInexistente(produtor);
        return _produtores[produtor];
    }

    function produtorPorCnpj(string calldata cnpjOuCpf) external view returns (address) {
        return _enderecoPorCnpj[keccak256(bytes(cnpjOuCpf))];
    }

    function totalProdutores() external view returns (uint256) {
        return _todos.length;
    }

    function produtorEm(uint256 indice) external view returns (address) {
        return _todos[indice];
    }
}
