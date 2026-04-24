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

  var ABI_LOTE = [
    "function historicoCompleto(uint256 tokenId) view returns (tuple(address produtor,uint8 commodity,uint256 quantidadeKg,uint256 dataColheita,string codigoInterno,bool ativo),tuple(uint8 tipo,address ator,uint256 timestamp,string localGPS,string localNome,bytes32 hashDocumento,string observacao)[])",
  ];

  var ABI_CERT_CONF = [
    "function certificadosDoLote(uint256 loteTokenId) view returns (uint256[])",
    "function detalhes(uint256 certId) view returns (tuple(uint256 loteTokenId,uint8 tipo,address emissor,string nomeEmissor,uint256 emitidoEm,uint256 validoAte,bytes32 hashDocumento,string observacao,bool revogado))",
  ];

  var COMMODITY = [
    "Não definida",
    "Soja",
    "Milho",
    "Carne Bovina",
    "Café",
    "Leite",
    "Minério de Ferro",
    "Outro",
  ];
  var TIPO_EVENTO = [
    "Colheita",
    "Transporte",
    "Armazenagem",
    "Processamento",
    "Exportação",
    "Entrega Final",
  ];
  var TIPO_CERTIFICADO = [
    "—",
    "EUDR",
    "ESG",
    "Orgânico",
    "GMO-Free",
    "Fair Trade",
    "Outro",
  ];

  var provider = null;
  function getProvider() {
    if (!provider) {
      // Auto-detect da rede: ethers v6 dispara eth_chainId na primeira call e
      // monta o objeto Network internamente. Evita problemas de coerção com
      // chainIds grandes (>2^31) recebidos como string do PHP.
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
    var eventos = resp[1];

    // Certificados (se contract configurado)
    var certsHtml = "";
    if (addrConf) {
      var conf = new ethers.Contract(addrConf, ABI_CERT_CONF, prov);
      var ids = await conf.certificadosDoLote(idBig);
      if (ids.length > 0) {
        var detalhes = await Promise.all(
          ids.map(function (id) {
            return conf.detalhes(id);
          })
        );
        certsHtml =
          "<h4>" +
          esc(i18n.certificados || "Certificados") +
          "</h4><ul class=\"acieg-rbb-certs\">" +
          detalhes
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
                fmtDate(c.validoAte) +
                ")</li>"
              );
            })
            .join("") +
          "</ul>";
      }
    }

    var eventosHtml = eventos
      .map(function (e, idx) {
        return (
          '<li class="acieg-rbb-evento">' +
          '<div class="acieg-rbb-evento-header"><span class="acieg-rbb-evento-num">' +
          (idx + 1) +
          "</span><strong>" +
          esc(TIPO_EVENTO[Number(e.tipo)] || "—") +
          "</strong> — " +
          esc(e.localNome) +
          "</div>" +
          '<div class="acieg-rbb-evento-meta">' +
          fmtDate(e.timestamp) +
          " — GPS: " +
          esc(e.localGPS || "—") +
          (e.observacao ? " — " + esc(e.observacao) : "") +
          (e.hashDocumento && e.hashDocumento !== ethers.ZeroHash
            ? '<br/><small>doc: <code>' + esc(e.hashDocumento) + "</code></small>"
            : "") +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    var html = [
      '<div class="acieg-rbb-card">',
      "<h3>" + esc(i18n.rastreioTitle || "Rastreabilidade Feito em Goiás") + " — Lote #" + idBig.toString() + "</h3>",
      "<dl>",
      "<dt>" + esc(i18n.codigoLote) + "</dt><dd>" + esc(info.codigoInterno) + "</dd>",
      "<dt>Commodity</dt><dd>" + esc(COMMODITY[Number(info.commodity)] || "—") + "</dd>",
      "<dt>" + esc(i18n.quantidade) + "</dt><dd>" + info.quantidadeKg.toString() + " kg</dd>",
      "<dt>Data colheita</dt><dd>" + fmtDate(info.dataColheita) + "</dd>",
      "<dt>" + esc(i18n.produtor) + "</dt><dd><code>" + esc(info.produtor) + "</code></dd>",
      "</dl>",
      "<h4>" + esc(i18n.cadeiaCustodia) + "</h4>",
      '<ol class="acieg-rbb-timeline">' + eventosHtml + "</ol>",
      certsHtml,
      "</div>",
    ].join("");
    setResult(el, html);
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

    // Inicialização automática se valor vier do shortcode.
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

    // Submit handlers.
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

    // Abas do certificado
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
