// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {RegistroProdutores} from "./RegistroProdutores.sol";

/// @title Lotes Rastreáveis "Feito em Goiás"
/// @notice Cada lote é um NFT (ERC-721) representando um conjunto de commodities rastreável
///         desde a origem (produtor registrado) até o destino final. Registra toda a cadeia
///         de custódia on-chain.
contract RastreabilidadeLote is ERC721, AccessControl {
    using Strings for uint256;

    enum Commodity {
        NAO_DEFINIDA,
        SOJA,
        MILHO,
        CARNE_BOVINA,
        CAFE,
        LEITE,
        MINERIO_FERRO,
        OUTRO
    }

    enum TipoEvento {
        COLHEITA,
        TRANSPORTE,
        ARMAZENAGEM,
        PROCESSAMENTO,
        EXPORTACAO,
        ENTREGA_FINAL
    }

    struct Lote {
        address produtor;
        Commodity commodity;
        uint256 quantidadeKg;
        uint256 dataColheita;
        string codigoInterno;   // Código ACIEG/produtor (ex: "RIV-2026-S-0042")
        bool ativo;
    }

    struct EventoCadeia {
        TipoEvento tipo;
        address ator;           // Quem registrou o evento
        uint256 timestamp;
        string localGPS;        // lat,long (string para flexibilidade)
        string localNome;       // ex: "Porto de Santos / SP"
        bytes32 hashDocumento;  // Hash de bill of lading, nota fiscal, etc.
        string observacao;
    }

    bytes32 public constant PRODUTOR_ROLE = keccak256("PRODUTOR_ROLE");
    bytes32 public constant TRANSPORTADOR_ROLE = keccak256("TRANSPORTADOR_ROLE");

    RegistroProdutores public immutable registro;
    uint256 private _proximoId;

    mapping(uint256 tokenId => Lote) private _lotes;
    mapping(uint256 tokenId => EventoCadeia[]) private _historico;

    event LoteCriado(
        uint256 indexed tokenId,
        address indexed produtor,
        Commodity commodity,
        uint256 quantidadeKg,
        string codigoInterno
    );
    event EventoRegistrado(
        uint256 indexed tokenId,
        TipoEvento indexed tipo,
        address indexed ator,
        string localNome
    );

    error ProdutorNaoRegistradoOuInativo(address produtor);
    error CommodityInvalida();
    error QuantidadeInvalida();
    error CodigoObrigatorio();
    error LoteInativo(uint256 tokenId);

    constructor(address admin, address registroAddress)
        ERC721(unicode"Lote Rastreavel Feito em Goias", "LOTE-FG")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        registro = RegistroProdutores(registroAddress);
    }

    /// @notice Produtor registrado cria novo lote. Precisa ter PRODUTOR_ROLE OU estar ativo no registro.
    function criarLote(
        Commodity commodity,
        uint256 quantidadeKg,
        uint256 dataColheita,
        string calldata codigoInterno
    ) external returns (uint256 tokenId) {
        if (!registro.produtorAtivo(msg.sender)) {
            revert ProdutorNaoRegistradoOuInativo(msg.sender);
        }
        if (commodity == Commodity.NAO_DEFINIDA) revert CommodityInvalida();
        if (quantidadeKg == 0) revert QuantidadeInvalida();
        if (bytes(codigoInterno).length == 0) revert CodigoObrigatorio();

        unchecked {
            tokenId = ++_proximoId;
        }

        _lotes[tokenId] = Lote({
            produtor: msg.sender,
            commodity: commodity,
            quantidadeKg: quantidadeKg,
            dataColheita: dataColheita,
            codigoInterno: codigoInterno,
            ativo: true
        });

        // Primeiro evento da cadeia: colheita na propriedade do produtor
        RegistroProdutores.Produtor memory p = registro.dadosProdutor(msg.sender);
        _historico[tokenId].push(
            EventoCadeia({
                tipo: TipoEvento.COLHEITA,
                ator: msg.sender,
                timestamp: dataColheita,
                localGPS: _formatGPS(p.latitudeE6, p.longitudeE6),
                localNome: p.municipio,
                hashDocumento: bytes32(0),
                observacao: "Colheita na propriedade do produtor"
            })
        );

        _safeMint(msg.sender, tokenId);

        emit LoteCriado(tokenId, msg.sender, commodity, quantidadeKg, codigoInterno);
    }

    /// @notice Registra um evento na cadeia de custódia (transporte, armazenagem, processamento, exportação).
    function registrarEvento(
        uint256 tokenId,
        TipoEvento tipo,
        string calldata localGPS,
        string calldata localNome,
        bytes32 hashDocumento,
        string calldata observacao
    ) external {
        _requireOwned(tokenId);
        if (!_lotes[tokenId].ativo) revert LoteInativo(tokenId);

        _historico[tokenId].push(
            EventoCadeia({
                tipo: tipo,
                ator: msg.sender,
                timestamp: block.timestamp,
                localGPS: localGPS,
                localNome: localNome,
                hashDocumento: hashDocumento,
                observacao: observacao
            })
        );

        emit EventoRegistrado(tokenId, tipo, msg.sender, localNome);
    }

    function historicoCompleto(uint256 tokenId)
        external
        view
        returns (Lote memory lote, EventoCadeia[] memory eventos)
    {
        _requireOwned(tokenId);
        lote = _lotes[tokenId];
        eventos = _historico[tokenId];
    }

    function totalEventos(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _historico[tokenId].length;
    }

    function loteInfo(uint256 tokenId) external view returns (Lote memory) {
        _requireOwned(tokenId);
        return _lotes[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Lote storage l = _lotes[tokenId];

        bytes memory json = abi.encodePacked(
            '{"name":"Lote FG #',
            tokenId.toString(),
            unicode'","description":"Lote rastreavel Feito em Goias registrado na RBB. Historico completo disponivel via historicoCompleto().",',
            '"attributes":[',
            '{"trait_type":"Codigo","value":"', l.codigoInterno, '"},',
            '{"trait_type":"Commodity","value":"', _commodityStr(l.commodity), '"},',
            '{"trait_type":"Quantidade (kg)","value":', l.quantidadeKg.toString(), "},",
            '{"trait_type":"Data Colheita","display_type":"date","value":', l.dataColheita.toString(), "},",
            '{"trait_type":"Eventos","value":', _historico[tokenId].length.toString(), "}",
            "]}"
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _commodityStr(Commodity c) private pure returns (string memory) {
        if (c == Commodity.SOJA) return "Soja";
        if (c == Commodity.MILHO) return "Milho";
        if (c == Commodity.CARNE_BOVINA) return "Carne Bovina";
        if (c == Commodity.CAFE) return "Cafe";
        if (c == Commodity.LEITE) return "Leite";
        if (c == Commodity.MINERIO_FERRO) return "Minerio de Ferro";
        return "Outro";
    }

    function _formatGPS(int256 latE6, int256 lonE6) private pure returns (string memory) {
        return string(abi.encodePacked(_intToStr(latE6), ",", _intToStr(lonE6)));
    }

    function _intToStr(int256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        bool neg = v < 0;
        uint256 u = uint256(neg ? -v : v);
        string memory s = u.toString();
        return neg ? string(abi.encodePacked("-", s)) : s;
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
