// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {RegistroProdutores} from "./RegistroProdutores.sol";

/// @title Lotes Rastreáveis "Feito em Goiás"
/// @notice Cada lote é um NFT (ERC-721) representando um conjunto rastreável — vegetal, animal,
///         mineral ou industrial. Modelo neutro: `commoditySlug` é string livre,
///         eventos seguem 12 Critical Tracking Events (GS1 EPCIS / FSMA 204) com `subTipo`
///         setorial namespaced (`VEG.*`, `BOV.*`, `SUI.*`, `OVI.*`, `AVE.*`, `AQU.*`, `API.*`,
///         `MIN.*`, `MAD.*`, `IND.*`, `ENE.*`). Vocabulário canônico vive off-chain (JSON
///         versionado por setor), permitindo cobrir qualquer commodity nova sem redeploy.
contract RastreabilidadeLote is ERC721, AccessControl {
    using Strings for uint256;

    /// @notice Critical Tracking Events universais (GS1 EPCIS / FSMA 204).
    enum CTE {
        ORIGEM,          //  0  insumo recebido (semente, matriz, MP, pesquisa mineral)
        PRODUCAO,        //  1  produção (plantio, criação, fabricação inicial)
        TRATAMENTO,      //  2  intervenção (insumo, vacinação, QC linha)
        MONITORAMENTO,   //  3  sensing/auditoria (satelital, sanitário, ambiental)
        EXTRACAO,        //  4  "creating_class_instance" (colheita, abate, lavra)
        BENEFICIAMENTO,  //  5  initial packing (limpeza, classificação, britagem, resfriamento)
        ARMAZENAGEM,     //  6  storing
        CERTIFICACAO,    //  7  fito (CFO) / sanitária (SIF) / mineral (LAOP) / industrial (INMETRO)
        TRANSPORTE,      //  8  shipping/receiving (PTV, GTA, DOF, NF-e)
        PROCESSAMENTO,   //  9  transformation (esmagamento, desossa, pelotização)
        EXPORTACAO,      // 10  export shipping (DUE)
        ENTREGA_FINAL    // 11  final receiving (EUDR DDS)
    }

    struct Lote {
        address produtor;
        string commoditySlug;     // ex: "SOJA" | "CARNE_SUINA" | "MEL" | "OURO" | "SEMENTE_SOJA"
        uint256 quantidadeKg;
        uint256 dataInicio;       // plantio | nascimento | abertura de lavra | recebimento MP
        uint256 dataExtracao;     // colheita | abate | lavra | finalização
        string codigoInterno;     // ex: "RIV-2026-S-0042"
        uint256 loteOrigem;       // tokenId do lote-pai (0 = nenhum); ex: SOJA→SEMENTE_SOJA
        bool ativo;
    }

    struct EventoCadeia {
        CTE cte;                 // bucket universal
        string subTipo;          // ex: "VEG.PLANTIO" | "BOV.NASCIMENTO" | "MIN.LAVRA"
        address ator;
        uint256 timestamp;
        string localGPS;         // "lat,long" (string flexível)
        string localNome;        // ex: "Porto de Santos / SP"
        bytes32 hashDocumento;   // hash de bill of lading, NF, CTRC, GTA, CFO etc.
        string observacao;       // KDEs (ex: "RENASEM=GO 0815/2024; cultivar=BMX")
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
        string commoditySlug,
        uint256 quantidadeKg,
        uint256 loteOrigem,
        string codigoInterno
    );
    event EventoRegistrado(
        uint256 indexed tokenId,
        CTE indexed cte,
        address indexed ator,
        string subTipo,
        string localNome
    );

    error ProdutorNaoRegistradoOuInativo(address produtor);
    error CommoditySlugObrigatorio();
    error QuantidadeInvalida();
    error CodigoObrigatorio();
    error LoteInativo(uint256 tokenId);
    error LoteOrigemInexistente(uint256 loteOrigem);

    constructor(address admin, address registroAddress)
        ERC721(unicode"Lote Rastreavel Feito em Goias", "LOTE-FG")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        registro = RegistroProdutores(registroAddress);
    }

    /// @notice Produtor registrado cria novo lote. Sem auto-eventos — o produtor é responsável
    ///         por chamar `registrarEvento` para cada marco do ciclo (plantio/nascimento,
    ///         tratamentos, monitoramento, extração/colheita/abate/lavra etc).
    /// @param commoditySlug Slug livre (SCREAMING_SNAKE_CASE). Vocabulário canônico off-chain.
    /// @param loteOrigem tokenId do lote-pai (0 = nenhum); usado para vínculo semente→lavoura,
    ///        matriz→bezerro, etc.
    function criarLote(
        string calldata commoditySlug,
        uint256 quantidadeKg,
        uint256 dataInicio,
        uint256 dataExtracao,
        string calldata codigoInterno,
        uint256 loteOrigem
    ) external returns (uint256 tokenId) {
        if (!registro.produtorAtivo(msg.sender)) {
            revert ProdutorNaoRegistradoOuInativo(msg.sender);
        }
        if (bytes(commoditySlug).length == 0) revert CommoditySlugObrigatorio();
        if (quantidadeKg == 0) revert QuantidadeInvalida();
        if (bytes(codigoInterno).length == 0) revert CodigoObrigatorio();
        if (loteOrigem != 0 && _lotes[loteOrigem].produtor == address(0)) {
            revert LoteOrigemInexistente(loteOrigem);
        }

        unchecked {
            tokenId = ++_proximoId;
        }

        _lotes[tokenId] = Lote({
            produtor: msg.sender,
            commoditySlug: commoditySlug,
            quantidadeKg: quantidadeKg,
            dataInicio: dataInicio,
            dataExtracao: dataExtracao,
            codigoInterno: codigoInterno,
            loteOrigem: loteOrigem,
            ativo: true
        });

        _safeMint(msg.sender, tokenId);

        emit LoteCriado(tokenId, msg.sender, commoditySlug, quantidadeKg, loteOrigem, codigoInterno);
    }

    /// @notice Registra um evento da cadeia de custódia. Caller deve ser o dono atual do lote.
    /// @param cte Bucket universal CTE (ORIGEM, PRODUCAO, TRATAMENTO, ..., ENTREGA_FINAL).
    /// @param subTipo Especialização setorial (ex: "VEG.PLANTIO", "BOV.ABATE"). String livre.
    /// @param timestamp Momento do evento (pode ser retroativo — útil para registrar
    ///        AQUISICAO_SEMENTE/PLANTIO depois do mint, com data anterior). 0 usa block.timestamp.
    function registrarEvento(
        uint256 tokenId,
        CTE cte,
        string calldata subTipo,
        uint256 timestamp,
        string calldata localGPS,
        string calldata localNome,
        bytes32 hashDocumento,
        string calldata observacao
    ) external {
        _requireOwned(tokenId);
        if (!_lotes[tokenId].ativo) revert LoteInativo(tokenId);

        uint256 ts = timestamp == 0 ? block.timestamp : timestamp;

        _historico[tokenId].push(
            EventoCadeia({
                cte: cte,
                subTipo: subTipo,
                ator: msg.sender,
                timestamp: ts,
                localGPS: localGPS,
                localNome: localNome,
                hashDocumento: hashDocumento,
                observacao: observacao
            })
        );

        emit EventoRegistrado(tokenId, cte, msg.sender, subTipo, localNome);
    }

    /// @notice Retorna o lote + histórico **ordenado por timestamp ascendente**.
    /// @dev Storage permanece em ordem de inserção (append cheap). Sort em memory garante
    ///      cronologia consistente para todos os consumidores, mesmo que eventos pré-extração
    ///      sejam registrados retroativamente após mint.
    function historicoCompleto(uint256 tokenId)
        external
        view
        returns (Lote memory lote, EventoCadeia[] memory eventos)
    {
        _requireOwned(tokenId);
        lote = _lotes[tokenId];

        EventoCadeia[] storage src = _historico[tokenId];
        uint256 n = src.length;
        eventos = new EventoCadeia[](n);
        for (uint256 i = 0; i < n; i++) {
            eventos[i] = src[i];
        }
        // Insertion sort por timestamp ascendente (n tipicamente <30).
        for (uint256 i = 1; i < n; i++) {
            EventoCadeia memory key = eventos[i];
            uint256 j = i;
            while (j > 0 && eventos[j - 1].timestamp > key.timestamp) {
                eventos[j] = eventos[j - 1];
                unchecked { j--; }
            }
            eventos[j] = key;
        }
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
            unicode'","description":"Lote rastreavel Feito em Goias registrado na RBB. Historico completo via historicoCompleto().",',
            '"attributes":[',
            '{"trait_type":"Codigo","value":"', l.codigoInterno, '"},',
            '{"trait_type":"Commodity","value":"', l.commoditySlug, '"},',
            '{"trait_type":"Quantidade (kg)","value":', l.quantidadeKg.toString(), "},",
            '{"trait_type":"Data Inicio","display_type":"date","value":', l.dataInicio.toString(), "},",
            '{"trait_type":"Data Extracao","display_type":"date","value":', l.dataExtracao.toString(), "},",
            '{"trait_type":"Lote Origem","value":', l.loteOrigem.toString(), "},",
            '{"trait_type":"Eventos","value":', _historico[tokenId].length.toString(), "}",
            "]}"
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
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
