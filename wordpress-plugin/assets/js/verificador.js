/* global aciegRbbConfig, ethers */
(function () {
  "use strict";

  if (typeof ethers === "undefined") {
    console.error("[ACIEG RBB] ethers.js não carregou.");
    return;
  }

  var cfg = window.aciegRbbConfig || {};
  var i18n = cfg.i18n || {};

  // ABIs mínimas (apenas view functions que o plugin chama).
  var ABI_SELO = [
    "function statusAtivo(address associado) view returns (bool)",
    "function dadosAssociado(address associado) view returns (tuple(string cnpjOuCpf,string razaoSocial,string setor,uint256 emitidoEm,uint256 validoAte,bool revogado,string motivoRevogacao))",
    "function verificarPorCnpj(string cnpjOuCpf) view returns (bool)",
    "function associadoPorCnpj(string cnpjOuCpf) view returns (address)",
  ];

  var ABI_CERT = [
    "function verificarPorHash(bytes32 hashPdf) view returns (bool,uint256)",
    "function detalhes(uint256 tokenId) view returns (tuple(bytes32 hashPdf,string nomeCurso,string nomeAluno,uint256 cargaHorariaHoras,uint256 dataConclusao,address emissor,bool revogado,string motivoRevogacao))",
  ];

  // RastreabilidadeLote — modelo neutro com CTE + subTipo + commoditySlug
  var ABI_LOTE = [
    "function historicoCompleto(uint256 tokenId) view returns (tuple(address produtor,string commoditySlug,uint256 quantidadeKg,uint256 dataInicio,uint256 dataExtracao,string codigoInterno,uint256 loteOrigem,bool ativo),tuple(uint8 cte,string subTipo,address ator,uint256 timestamp,string localGPS,string localNome,bytes32 hashDocumento,string observacao)[])",
    // ERC-721 Transfer event — chain-of-custody legal (transferência de posse do NFT)
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ];

  // RegistroProdutores — para resolver dados do produtor (polígono, RENASEM, município)
  var ABI_REG = [
    "function dadosProdutor(address produtor) view returns (tuple(string cnpjOuCpf,string nome,string car,string municipio,int256 latitudeE6,int256 longitudeE6,bytes32 poligonoCARHash,string poligonoURI,string renasem,uint8 setor,bool ativo,uint256 cadastradoEm))",
  ];

  var ABI_CERT_CONF = [
    "function certificadosDoLote(uint256 loteTokenId) view returns (uint256[])",
    "function detalhes(uint256 certId) view returns (tuple(uint256 loteTokenId,uint8 tipo,address emissor,string nomeEmissor,uint256 emitidoEm,uint256 validoAte,bytes32 hashDocumento,string observacao,bool revogado))",
  ];

  // CTE buckets universais (RastreabilidadeLote.sol)
  var CTE_LABELS = [
    "Origem",
    "Produção",
    "Tratamento",
    "Monitoramento",
    "Extração",
    "Beneficiamento",
    "Armazenagem",
    "Certificação",
    "Transporte",
    "Processamento",
    "Exportação",
    "Entrega Final",
  ];
  // 3-fase color groups: 0..3 origem/produção (verde) | 4..7 transição (laranja) | 8..11 logística (azul)
  var CTE_PHASE = ["origem", "origem", "origem", "origem", "transicao", "transicao", "transicao", "transicao", "logistica", "logistica", "logistica", "logistica"];

  var TIPO_CERTIFICADO = ["—", "EUDR", "ESG", "Orgânico", "GMO-Free", "Fair Trade", "Outro"];

  // Setor enum (RegistroProdutores.sol)
  var SETOR_LABEL = ["—", "Agropecuária", "Mineração", "Indústria", "Sementeira"];

  var provider = null;
  function getProvider() {
    if (!provider) {
      provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    }
    return provider;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmtDate(ts) {
    if (!ts || ts === 0n) return "—";
    try {
      return new Date(Number(ts) * 1000).toLocaleString("pt-BR");
    } catch (e) {
      return "—";
    }
  }

  function fmtDateOnly(ts) {
    if (!ts || ts === 0n) return "—";
    try {
      return new Date(Number(ts) * 1000).toLocaleDateString("pt-BR");
    } catch (e) {
      return "—";
    }
  }

  function setResult(el, html) {
    var result = el.querySelector(".acieg-rbb-result");
    result.innerHTML = html;
  }

  function setLoading(el) {
    setResult(el, '<div class="acieg-rbb-loading">' + esc(i18n.loading || "Consultando...") + "</div>");
  }

  function setError(el, msg) {
    setResult(el, '<div class="acieg-rbb-msg acieg-rbb-msg-error">' + esc(msg) + "</div>");
  }

  function statusBadge(status) {
    var cls = "acieg-rbb-badge-" + status.toLowerCase();
    return '<span class="acieg-rbb-badge ' + cls + '">' + esc(status) + "</span>";
  }

  function limparCnpj(s) {
    return String(s || "").replace(/[^0-9]/g, "");
  }

  // ==================== VOCABULÁRIO (carregamento setorial dinâmico) ====================
  var vocabCache = {}; // setor -> {events, commodities, ...}
  var vocabPromises = {};

  async function carregarVocabulario(setor) {
    if (vocabCache[setor]) return vocabCache[setor];
    if (vocabPromises[setor]) return vocabPromises[setor];
    var base = cfg.vocabularioBaseUrl;
    if (!base) {
      vocabCache[setor] = { events: {}, commodities: {} };
      return vocabCache[setor];
    }
    var url = base.replace(/\/$/, "") + "/" + setor + ".json";
    vocabPromises[setor] = fetch(url, { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("vocab " + setor + " HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        vocabCache[setor] = json;
        return json;
      })
      .catch(function (err) {
        console.warn("[ACIEG RBB] vocabulário '" + setor + "' indisponível:", err);
        vocabCache[setor] = { events: {}, commodities: {} };
        return vocabCache[setor];
      });
    return vocabPromises[setor];
  }

  // Mapeia prefixo do subTipo para o nome do arquivo do setor.
  var SETOR_POR_PREFIXO = {
    VEG: "vegetal",
    BOV: "bovino",
    SUI: "suino",
    OVI: "ovino",
    AVE: "avicultura",
    AQU: "aquicultura",
    API: "apicultura",
    MIN: "mineracao",
    MAD: "madeira",
    IND: "industria",
    ENE: "energia",
  };

  function inferirSetorDoSubTipo(subTipo) {
    if (!subTipo) return null;
    var pre = subTipo.split(".")[0];
    return SETOR_POR_PREFIXO[pre] || null;
  }

  // Resolve label/sigla/padrão de um subTipo via vocabulário (ou retorna fallback bruto).
  function resolverEvento(vocab, subTipo) {
    var ev = vocab && vocab.events && vocab.events[subTipo];
    if (ev) return ev;
    return { label: subTipo || "—", sigla: null, padrao: null, urn: null };
  }

  // Resolve label/NCM/scientific de um commoditySlug via vocabulário.
  function resolverCommodity(vocab, slug) {
    var c = vocab && vocab.commodities && vocab.commodities[slug];
    if (c) return c;
    return { label: slug || "—", ncm: null, scientific: null };
  }

  // ==================== SELO ====================
  async function verificarSelo(el, input) {
    var addrSelo = cfg.contracts.selo;
    if (!addrSelo) return setError(el, "Endereço do contrato Selo não configurado.");
    var prov = getProvider();
    var contract = new ethers.Contract(addrSelo, ABI_SELO, prov);

    var endereco;
    if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
      endereco = input;
    } else {
      var cnpj = limparCnpj(input);
      if (!cnpj) return setError(el, "Informe um CNPJ/CPF ou endereço 0x…");
      endereco = await contract.associadoPorCnpj(cnpj);
      if (endereco === ethers.ZeroAddress) {
        return setResult(
          el,
          '<div class="acieg-rbb-msg acieg-rbb-msg-warn">' +
            esc(i18n.notFound || "Registro não encontrado.") +
            "</div>"
        );
      }
    }

    var ativo = await contract.statusAtivo(endereco);
    var dados = await contract.dadosAssociado(endereco);

    var status = ativo
      ? i18n.active || "ATIVO"
      : dados.revogado
      ? i18n.revoked || "REVOGADO"
      : i18n.expired || "EXPIRADO";

    var html = [
      '<div class="acieg-rbb-card">',
      "<h3>" + esc(i18n.seloTitle || "Selo Digital ACIEG") + " " + statusBadge(status) + "</h3>",
      "<dl>",
      "<dt>" + esc(i18n.razaoSocial) + "</dt><dd>" + esc(dados.razaoSocial) + "</dd>",
      "<dt>CNPJ/CPF</dt><dd>" + esc(dados.cnpjOuCpf) + "</dd>",
      "<dt>" + esc(i18n.setor) + "</dt><dd>" + esc(dados.setor) + "</dd>",
      "<dt>" + esc(i18n.emitidoEm) + "</dt><dd>" + fmtDate(dados.emitidoEm) + "</dd>",
      "<dt>" + esc(i18n.validoAte) + "</dt><dd>" + fmtDate(dados.validoAte) + "</dd>",
      "<dt>Endereço</dt><dd><code>" + esc(endereco) + "</code></dd>",
      dados.revogado && dados.motivoRevogacao
        ? "<dt>Motivo</dt><dd>" + esc(dados.motivoRevogacao) + "</dd>"
        : "",
      "</dl>",
      linkExplorer(endereco),
      "</div>",
    ].join("");
    setResult(el, html);
  }

  // ==================== CERTIFICADO ====================
  async function sha256Arquivo(file) {
    var buf = await file.arrayBuffer();
    var hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return (
      "0x" +
      Array.from(new Uint8Array(hashBuf))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  async function verificarCertificado(el, hash) {
    var addrCert = cfg.contracts.certificado;
    if (!addrCert) return setError(el, "Endereço do contrato Certificado não configurado.");
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return setError(el, "Hash SHA-256 inválido.");
    }
    var prov = getProvider();
    var contract = new ethers.Contract(addrCert, ABI_CERT, prov);

    var r = await contract.verificarPorHash(hash);
    var valido = r[0];
    var tokenId = r[1];

    if (tokenId === 0n) {
      return setResult(
        el,
        '<div class="acieg-rbb-msg acieg-rbb-msg-warn">' +
          esc(i18n.notFound || "Certificado não encontrado nesta blockchain.") +
          "</div>"
      );
    }

    var d = await contract.detalhes(tokenId);
    var status = valido ? i18n.valid || "VÁLIDO" : i18n.revoked || "REVOGADO";

    var html = [
      '<div class="acieg-rbb-card">',
      "<h3>" + esc(i18n.certTitle || "Certificado ACIEG") + " " + statusBadge(status) + "</h3>",
      "<dl>",
      "<dt>" + esc(i18n.curso) + "</dt><dd>" + esc(d.nomeCurso) + "</dd>",
      "<dt>" + esc(i18n.aluno) + "</dt><dd>" + esc(d.nomeAluno) + "</dd>",
      "<dt>" + esc(i18n.cargaHoraria) + "</dt><dd>" + d.cargaHorariaHoras.toString() + " h</dd>",
      "<dt>" + esc(i18n.dataConclusao) + "</dt><dd>" + fmtDate(d.dataConclusao) + "</dd>",
      "<dt>" + esc(i18n.hashPdf) + "</dt><dd><code>" + esc(hash) + "</code></dd>",
      "<dt>Token ID</dt><dd>#" + tokenId.toString() + "</dd>",
      "<dt>Emissor</dt><dd><code>" + esc(d.emissor) + "</code></dd>",
      d.revogado ? "<dt>Motivo</dt><dd>" + esc(d.motivoRevogacao) + "</dd>" : "",
      "</dl>",
      linkExplorer(d.emissor),
      "</div>",
    ].join("");
    setResult(el, html);
  }

  // ==================== RASTREABILIDADE ====================
  async function rastrearLote(el, loteId) {
    var addrLote = cfg.contracts.rastreabilidade;
    var addrConf = cfg.contracts.certificadosConf;
    var addrReg = cfg.contracts.registroProdutor;
    if (!addrLote) return setError(el, "Endereço do contrato Rastreabilidade não configurado.");

    var prov = getProvider();
    var lote = new ethers.Contract(addrLote, ABI_LOTE, prov);

    var idBig;
    try {
      idBig = BigInt(loteId);
    } catch (e) {
      return setError(el, "ID do lote deve ser um número inteiro positivo.");
    }

    var resp = await lote.historicoCompleto(idBig);
    var info = resp[0];
    var eventos = resp[1].slice().sort(function (a, b) {
      // sort defensivo (contrato já ordena, mas garantimos)
      return Number(a.timestamp) - Number(b.timestamp);
    });

    // ERC-721 Transfer events do tokenId — fonte canônica de mudanças de posse
    var transfers = [];
    try {
      var transferFilter = lote.filters.Transfer(null, null, idBig);
      var transferLogs = await lote.queryFilter(transferFilter);
      transfers = await Promise.all(
        transferLogs
          .filter(function (log) { return log.args.from !== ethers.ZeroAddress; }) // filtra mint
          .map(async function (log) {
            var block = await log.getBlock();
            return {
              kind: "transfer",
              from: log.args.from,
              to: log.args.to,
              timestamp: BigInt(block.timestamp),
              txHash: log.transactionHash,
            };
          })
      );
    } catch (err) {
      console.warn("[ACIEG RBB] queryFilter Transfer falhou:", err);
    }

    // Trilha cronológica unificada: eventos custom + transfers ERC-721
    var eventosKind = eventos.map(function (e) {
      return {
        kind: "evento",
        cte: e.cte,
        subTipo: e.subTipo,
        ator: e.ator,
        timestamp: e.timestamp,
        localGPS: e.localGPS,
        localNome: e.localNome,
        hashDocumento: e.hashDocumento,
        observacao: e.observacao,
      };
    });
    var trilha = eventosKind.concat(transfers).sort(function (a, b) {
      return Number(a.timestamp) - Number(b.timestamp);
    });

    // Carrega vocabulário inferido pelo prefixo do primeiro subTipo (default: vegetal)
    var setor = null;
    for (var i = 0; i < eventos.length; i++) {
      var s = inferirSetorDoSubTipo(eventos[i].subTipo);
      if (s) { setor = s; break; }
    }
    if (!setor) {
      // sem eventos ainda: tenta inferir pelo commoditySlug (heurística simples)
      var slug = info.commoditySlug || "";
      if (/^(SOJA|MILHO|CAFE|CACAU|CANA|ALGODAO|MADEIRA|BORRACHA|OLEO|SEMENTE_)/i.test(slug)) setor = "vegetal";
      else if (/^CARNE_BOVINA|^LEITE/i.test(slug)) setor = "bovino";
      else if (/^CARNE_SUINA/i.test(slug)) setor = "suino";
      else if (/^CARNE_OVINA/i.test(slug)) setor = "ovino";
      else if (/^FRANGO|^OVO/i.test(slug)) setor = "avicultura";
      else if (/^MEL/i.test(slug)) setor = "apicultura";
      else if (/^MINERIO|^OURO/i.test(slug)) setor = "mineracao";
      else setor = "vegetal";
    }
    var vocab = await carregarVocabulario(setor);
    var commodity = resolverCommodity(vocab, info.commoditySlug);

    // Bloco "Origem do lote" — produtor, polígono, lote-pai
    var origemHtml = "";
    if (addrReg) {
      try {
        var reg = new ethers.Contract(addrReg, ABI_REG, prov);
        var prod = await reg.dadosProdutor(info.produtor);
        var poligonoLink = prod.poligonoURI
          ? '<a href="' + esc(prod.poligonoURI) + '" target="_blank" rel="noopener">' + esc(i18n.verPoligono || "Ver polígono CAR") + "</a>"
          : "—";
        origemHtml =
          "<dl>" +
          "<dt>Produtor</dt><dd>" + esc(prod.nome) + " (" + esc(SETOR_LABEL[Number(prod.setor)] || "—") + ")</dd>" +
          "<dt>Município</dt><dd>" + esc(prod.municipio) + "</dd>" +
          "<dt>CAR</dt><dd>" + esc(prod.car || "—") + "</dd>" +
          "<dt>Polígono</dt><dd>" + poligonoLink + "</dd>" +
          (prod.renasem ? "<dt>RENASEM</dt><dd>" + esc(prod.renasem) + "</dd>" : "") +
          "<dt>Endereço</dt><dd><code>" + esc(info.produtor) + "</code></dd>" +
          "</dl>";
      } catch (e) {
        console.warn("[ACIEG RBB] dadosProdutor indisponível:", e);
        origemHtml = '<dl><dt>Produtor</dt><dd><code>' + esc(info.produtor) + "</code></dd></dl>";
      }
    } else {
      origemHtml = '<dl><dt>Produtor</dt><dd><code>' + esc(info.produtor) + "</code></dd></dl>";
    }

    var loteOrigemHtml = "";
    if (info.loteOrigem && info.loteOrigem !== 0n) {
      var pai = info.loteOrigem.toString();
      loteOrigemHtml =
        '<p class="acieg-rbb-lote-pai">' +
        esc(i18n.loteOrigem || "Lote-pai") +
        ': <a href="#" class="acieg-rbb-link-pai" data-lote-pai="' + esc(pai) + '">#' + esc(pai) + "</a>" +
        "</p>";
    }

    // Certificados de conformidade
    var certs = [];
    if (addrConf) {
      var conf = new ethers.Contract(addrConf, ABI_CERT_CONF, prov);
      var ids = await conf.certificadosDoLote(idBig);
      if (ids.length > 0) {
        certs = await Promise.all(
          ids.map(function (id) {
            return conf.detalhes(id);
          })
        );
      }
    }
    var certsHtml = "";
    if (certs.length > 0) {
      certsHtml =
        "<h4>" +
        esc(i18n.certificados || "Certificados") +
        '</h4><ul class="acieg-rbb-certs">' +
        certs
          .map(function (c) {
            var valido = !c.revogado && BigInt(Math.floor(Date.now() / 1000)) <= c.validoAte;
            return (
              "<li>" +
              statusBadge(valido ? i18n.valid || "VÁLIDO" : "INVÁLIDO") +
              " <strong>" +
              esc(TIPO_CERTIFICADO[Number(c.tipo)] || "—") +
              "</strong> — " +
              esc(c.nomeEmissor) +
              " (válido até " +
              fmtDateOnly(c.validoAte) +
              ")</li>"
            );
          })
          .join("") +
        "</ul>";
    }

    // Conformidade — calculada do subTipo / certificados / loteOrigem
    var sufixos = eventos.map(function (e) {
      var parts = (e.subTipo || "").split(".");
      return parts.length > 1 ? parts[1] : "";
    });
    var temEUDR = certs.some(function (c) {
      var valido = !c.revogado && BigInt(Math.floor(Date.now() / 1000)) <= c.validoAte;
      return Number(c.tipo) === 1 && valido;
    });
    var temMonitoramento = eventos.some(function (e) { return Number(e.cte) === 3; });
    var conformidade = [
      { label: "EUDR (UE 2023/1115)", ok: temEUDR && temMonitoramento },
      { label: "RENASEM (semente)", ok: (info.commoditySlug || "").indexOf("SEMENTE_") === 0 || (info.loteOrigem && info.loteOrigem !== 0n) },
      { label: "CFO/CFOC (fitossanitário)", ok: sufixos.indexOf("CFO") >= 0 || sufixos.indexOf("CFOC") >= 0 },
      { label: "PTV (trânsito vegetal)", ok: sufixos.indexOf("PTV") >= 0 },
      { label: "GTA (trânsito animal)", ok: sufixos.indexOf("GTA") >= 0 },
      { label: "SIF (inspeção federal)", ok: sufixos.indexOf("SIF") >= 0 },
      { label: "DOF (madeira/florestal)", ok: sufixos.some(function (s) { return s.indexOf("DOF") === 0; }) },
      { label: "Monitoramento satelital", ok: temMonitoramento },
    ];
    var aplicaveis = conformidade.filter(function (c) { return c.ok; });
    var conformidadeHtml = "";
    if (aplicaveis.length > 0) {
      conformidadeHtml =
        "<h4>" + esc(i18n.conformidade || "Conformidade regulatória") + "</h4>" +
        '<ul class="acieg-rbb-conformidade">' +
        aplicaveis.map(function (c) {
          return '<li>' + statusBadge(i18n.valid || "VÁLIDO") + " " + esc(c.label) + "</li>";
        }).join("") +
        "</ul>";
    }

    // Timeline cronológica unificada (eventos + transfers ERC-721)
    var eventoNum = 0;
    var trilhaHtml = trilha
      .map(function (item) {
        if (item.kind === "transfer") {
          // Transferência de posse — linha distintiva, sem badge numerado
          var fromShort = item.from.slice(0, 6) + "…" + item.from.slice(-4);
          var toShort = item.to.slice(0, 6) + "…" + item.to.slice(-4);
          return (
            '<li class="acieg-rbb-transfer">' +
            '<div class="acieg-rbb-transfer-header">' +
            '<span class="acieg-rbb-transfer-arrow">↓</span>' +
            "<strong>Posse transferida</strong> " +
            '<code>' + esc(fromShort) + "</code> → <code>" + esc(toShort) + "</code>" +
            "</div>" +
            '<div class="acieg-rbb-transfer-meta">' +
            fmtDate(item.timestamp) +
            ' · <small>tx: <code>' + esc(item.txHash) + "</code></small>" +
            "</div>" +
            "</li>"
          );
        }
        // Evento custom
        eventoNum += 1;
        var e = item;
        var cteIdx = Number(e.cte);
        var cteLabel = CTE_LABELS[cteIdx] || "—";
        var fase = CTE_PHASE[cteIdx] || "outro";
        var meta = resolverEvento(vocab, e.subTipo);
        var tagSigla = meta.sigla ? ' <span class="acieg-rbb-sigla">' + esc(meta.sigla) + "</span>" : "";
        var tagPadrao = meta.padrao ? '<small class="acieg-rbb-padrao">' + esc(meta.padrao) + "</small>" : "";
        return (
          '<li class="acieg-rbb-evento acieg-rbb-fase-' + fase + '">' +
          '<div class="acieg-rbb-evento-header">' +
          '<span class="acieg-rbb-evento-num">' + eventoNum + "</span>" +
          "<strong>" + esc(meta.label) + "</strong>" + tagSigla +
          ' <span class="acieg-rbb-cte-tag">' + esc(cteLabel) + "</span>" +
          " — " + esc(e.localNome) +
          "</div>" +
          '<div class="acieg-rbb-evento-meta">' +
          fmtDate(e.timestamp) +
          " · GPS: " + esc(e.localGPS || "—") +
          (e.observacao ? " · " + esc(e.observacao) : "") +
          (e.hashDocumento && e.hashDocumento !== ethers.ZeroHash
            ? '<br/><small>doc: <code>' + esc(e.hashDocumento) + "</code></small>"
            : "") +
          (tagPadrao ? "<br/>" + tagPadrao : "") +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    var ncmStr = commodity.ncm ? " · NCM " + esc(commodity.ncm) : "";
    var sciStr = commodity.scientific ? " · <em>" + esc(commodity.scientific) + "</em>" : "";

    var html = [
      '<div class="acieg-rbb-card">',
      "<h3>" + esc(i18n.rastreioTitle || "Rastreabilidade Feito em Goiás") + " — Lote #" + idBig.toString() + "</h3>",
      "<dl>",
      "<dt>" + esc(i18n.codigoLote) + "</dt><dd>" + esc(info.codigoInterno) + "</dd>",
      "<dt>Commodity</dt><dd>" + esc(commodity.label) + ncmStr + sciStr + "</dd>",
      "<dt>" + esc(i18n.quantidade) + "</dt><dd>" + info.quantidadeKg.toString() + " kg</dd>",
      "<dt>Início do ciclo</dt><dd>" + fmtDateOnly(info.dataInicio) + "</dd>",
      "<dt>Extração</dt><dd>" + fmtDateOnly(info.dataExtracao) + "</dd>",
      "</dl>",
      loteOrigemHtml,
      "<h4>" + esc(i18n.origemLote || "Origem do lote") + "</h4>",
      origemHtml,
      "<h4>" + esc(i18n.cadeiaCustodia || "Cadeia de custódia") + "</h4>",
      '<ol class="acieg-rbb-timeline">' + trilhaHtml + "</ol>",
      certsHtml,
      conformidadeHtml,
      "</div>",
    ].join("");
    setResult(el, html);

    // Habilita link "Lote-pai" para nova consulta
    var linkPai = el.querySelector(".acieg-rbb-link-pai");
    if (linkPai) {
      linkPai.addEventListener("click", function (ev) {
        ev.preventDefault();
        var loteId = linkPai.getAttribute("data-lote-pai");
        var input = el.querySelector(".acieg-rbb-input");
        if (input) input.value = loteId;
        setLoading(el);
        rastrearLote(el, loteId).catch(function (err) {
          console.error(err);
          setError(el, i18n.consultError || "Erro ao consultar.");
        });
      });
    }
  }

  function linkExplorer(addr) {
    if (!cfg.explorerBase || !addr) return "";
    return (
      '<p class="acieg-rbb-link"><a href="' +
      cfg.explorerBase.replace(/\/$/, "") +
      "/address/" +
      encodeURIComponent(addr) +
      '" target="_blank" rel="noopener">' +
      esc(i18n.verNaBlockchain || "Ver na blockchain") +
      "</a></p>"
    );
  }

  // ==================== BOOTSTRAP ====================
  function initWidget(el) {
    var form = el.querySelector("form");
    var tipo = el.getAttribute("data-widget");
    var btn = form.querySelector("button[type=submit]");

    if (tipo === "selo") {
      var presetCnpj = el.getAttribute("data-cnpj");
      var presetEnd = el.getAttribute("data-endereco");
      if (presetCnpj || presetEnd) {
        setLoading(el);
        verificarSelo(el, presetCnpj || presetEnd).catch(function (err) {
          console.error(err);
          setError(el, i18n.consultError || "Erro ao consultar.");
        });
      }
    }
    if (tipo === "rastreabilidade") {
      var presetId = el.getAttribute("data-lote-id");
      if (presetId) {
        setLoading(el);
        rastrearLote(el, presetId).catch(function (err) {
          console.error(err);
          setError(el, i18n.consultError || "Erro ao consultar.");
        });
      }
    }
    if (tipo === "certificado") {
      var presetHash = el.getAttribute("data-hash");
      if (presetHash) {
        setLoading(el);
        verificarCertificado(el, presetHash).catch(function (err) {
          console.error(err);
          setError(el, i18n.consultError || "Erro ao consultar.");
        });
      }
    }

    btn.addEventListener("click", async function () {
      try {
        setLoading(el);
        if (tipo === "selo") {
          var inp = form.querySelector(".acieg-rbb-input").value.trim();
          await verificarSelo(el, inp);
        } else if (tipo === "certificado") {
          var paneHash = el.querySelector('.acieg-rbb-pane-hash[data-pane="hash"]');
          var panePdf = el.querySelector('.acieg-rbb-pane-pdf[data-pane="pdf"]');
          var hashFinal;
          if (!panePdf.hidden) {
            var file = el.querySelector(".acieg-rbb-file").files[0];
            if (!file) return setError(el, "Selecione um PDF.");
            hashFinal = await sha256Arquivo(file);
          } else {
            hashFinal = el.querySelector('.acieg-rbb-pane-hash .acieg-rbb-input').value.trim();
            if (!hashFinal.startsWith("0x")) hashFinal = "0x" + hashFinal;
          }
          await verificarCertificado(el, hashFinal);
        } else if (tipo === "rastreabilidade") {
          var id = form.querySelector(".acieg-rbb-input").value.trim();
          await rastrearLote(el, id);
        }
      } catch (err) {
        console.error("[ACIEG RBB]", err);
        var detalhe = (err && (err.shortMessage || err.message || err.code)) || "";
        var base = i18n.consultError || "Erro ao consultar.";
        setError(el, detalhe ? base + " (" + String(detalhe).slice(0, 160) + ")" : base);
      }
    });

    if (tipo === "certificado") {
      var tabs = el.querySelectorAll(".acieg-rbb-tab");
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (t) {
            t.classList.remove("acieg-rbb-tab-active");
          });
          tab.classList.add("acieg-rbb-tab-active");
          var key = tab.getAttribute("data-tab");
          el.querySelectorAll(".acieg-rbb-pane").forEach(function (p) {
            p.hidden = p.getAttribute("data-pane") !== key;
          });
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  function init() {
    document.querySelectorAll(".acieg-rbb-widget").forEach(initWidget);
  }
})();
