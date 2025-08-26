(function () {
  // Utils
  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]
    );
  }

  // Tab controller (one-time init per tab)
  const tabs = [
    {
      btn: document.getElementById('tab-reaction'),
      panel: document.getElementById('panel-reaction'),
      hash: '#reaction',
      init: initReactionOnce,
    },
    {
      btn: document.getElementById('tab-dag'),
      panel: document.getElementById('panel-dag'),
      hash: '#dag',
      init: initDagOnce,
    },
  ];

  const inited = new Set();

  function activate(tab) {
    tabs.forEach((t) => {
      const on = t === tab;

      t.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      t.panel.classList.toggle('active', on);
    });
    history.replaceState(null, '', tab.hash);

    if (!inited.has(tab.hash)) {
      try {
        tab.init();
      } catch (e) {
        console.error(e);
      }

      inited.add(tab.hash);
    }
  }

  tabs.forEach((t) => t.btn.addEventListener('click', () => activate(t)));
  activate(tabs.find((t) => t.hash === location.hash) || tabs[0]);

  // Reaction Graph
  function initReactionOnce() {
    if (!window.d3) {
      console.warn('D3 not loaded');

      return;
    }

    const svg = d3.select('#reactionSvg');

    const g = svg.append('g');

    const linkG = g.append('g');

    const nodeG = g.append('g');

    const legendEl = document.getElementById('reactionLegend');

    const searchInput = document.getElementById('reactionSearch');

    const tip = document.createElement('div');

    tip.className = 'tip';
    document.body.appendChild(tip);
    const zoom = d3
      .zoom()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (ev) => g.attr('transform', ev.transform));

    svg.call(zoom);
    const color = {
      host: '#e7f1ff',
      agent: '#efefef',
      vector: '#fff0c2',
      artifact: '#fff7db',
      stage: '#f3f6f9',
      species: '#e9f7ef',
      organism: '#f1f8ff',
      hybrid: '#f9e6ef',
      process: '#fbecff',
      meta: '#f0f0f0',
    };

    const R = 19;

    const RP = 17;

    fetch('reaction.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('reaction.json not found'))))
      .then((data) => {
        const procNodes = (data.processes || []).map((p) => ({ id: p.id || p, type: 'process' }));

        const nodes = [...(data.nodes || []), ...procNodes];

        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        const links = (data.links || []).filter(
          (e) => nodeMap.has(e.source) && nodeMap.has(e.target)
        );

        const sim = d3
          .forceSimulation(nodes)
          .force(
            'link',
            d3
              .forceLink(links)
              .id((d) => d.id)
              .distance(90)
              .strength(0.4)
          )
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(window.innerWidth / 2, (window.innerHeight - 52) / 2))
          .force('collide', d3.forceCollide(28));

        const link = linkG
          .selectAll('path')
          .data(links)
          .enter()
          .append('path')
          .attr('class', 'edge');

        const linkLabel = linkG
          .selectAll('text')
          .data(links)
          .enter()
          .append('text')
          .attr('class', 'edge-label')
          .text((d) => edgeLabel(d.kind));

        const node = nodeG
          .selectAll('g')
          .data(nodes)
          .enter()
          .append('g')
          .attr('class', 'node')
          .call(drag(sim));

        node.each(function (d) {
          const sel = d3.select(this);

          if (d.type === 'process') {
            sel
              .append('rect')
              .attr('x', -RP)
              .attr('y', -RP)
              .attr('width', RP * 2)
              .attr('height', RP * 2)
              .attr('transform', 'rotate(45)')
              .attr('fill', color.process);
          } else {
            sel
              .append('circle')
              .attr('r', R)
              .attr('fill', color[d.type] || '#bbb');
          }

          sel.append('text').attr('class', 'label').attr('dy', -26).text(d.id);
        });
        node
          .on('mousemove', (ev, d) => {
            tip.innerHTML = `<b>${escapeHtml(d.id)}</b> <span class="pill">${escapeHtml(d.type || '')}</span>`;
            tip.style.left = `${ev.clientX + 12}px`;
            tip.style.top = `${ev.clientY + 12}px`;
            tip.style.opacity = 1;
          })
          .on('mouseleave', () => (tip.style.opacity = 0));

        sim.on('tick', () => {
          link.attr('d', (d) => curved(d));
          linkLabel
            .attr('x', (d) => (d.source.x + d.target.x) / 2)
            .attr('y', (d) => (d.source.y + d.target.y) / 2 - 6);
          node.attr('transform', (d) => `translate(${d.x},${d.y})`);
        });

        function drawLegend() {
          if (!legendEl) return;
          const keys = [
            'host',
            'agent',
            'vector',
            'artifact',
            'stage',
            'species',
            'organism',
            'hybrid',
            'process',
          ];

          const wrap = document.createElement('div');

          wrap.style.display = 'grid';
          wrap.style.gridTemplateColumns = '1fr 1fr';
          wrap.style.gap = '8px 16px';
          keys.forEach((k) => {
            const row = document.createElement('div');

            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            const icon = document.createElement('span');

            icon.style.display = 'inline-block';
            icon.style.width = '18px';
            icon.style.height = '18px';
            icon.style.background = color[k];
            icon.style.border = '1.5px solid #222';

            if (k === 'process') {
              icon.style.borderRadius = '2px';
              icon.style.transform = 'rotate(45deg)';
            } else {
              icon.style.borderRadius = '9999px';
            }

            const label = document.createElement('span');

            label.textContent = k;
            label.style.fontSize = '14px';
            row.appendChild(icon);
            row.appendChild(label);
            wrap.appendChild(row);
          });
          legendEl.innerHTML = '';
          legendEl.appendChild(wrap);
        }

        drawLegend();

        function runSearch(q) {
          const query = (q || '').trim().toLowerCase();

          const ids = new Set();

          if (query)
            nodes.forEach((n) => {
              if ((n.id || '').toLowerCase().includes(query)) ids.add(n.id);
            });
          node.classed('highlight', (d) => ids.has(d.id));
          link.classed('edge-highlight', (d) => ids.has(d.source.id) || ids.has(d.target.id));
        }

        searchInput.addEventListener('input', (e) => runSearch(e.target.value));
        window.addEventListener('resize', () =>
          sim.force('center', d3.forceCenter(window.innerWidth / 2, (window.innerHeight - 52) / 2))
        );

        function curved(d) {
          const sx = d.source.x,
            sy = d.source.y,
            tx = d.target.x,
            ty = d.target.y;

          const cx = (sx + tx) / 2,
            cy = (sy + ty) / 2 - 12;

          return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        }

        function drag(sim) {
          function dragstarted(event, d) {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          }

          function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
          }

          function dragended(event, d) {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }

          return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
        }

        function edgeLabel(kind) {
          const map = {
            reproduction: 'lays/produces',
            maturation: 'matures',
            implantation: 'implants',
            host: 'host',
            evolution: 'evolves',
            infection: 'infects',
            contaminate: 'contaminates',
            release: 'releases',
            parasite: 'parasitic outcome',
            biogenesis: 'forms egg',
            experiment: 'experiment',
            anomalous: 'anomalous birth',
            origin: 'origin',
            impregnation: 'impregnates',
            result: 'result',
            transmission: 'transmission',
            cloning: 'cloning',
          };

          return map[kind] || kind;
        }
      })
      .catch((err) => {
        console.warn(err.message);
        const m = document.createElement('div');

        m.className = 'notice';
        m.textContent = 'reaction.json not found — reaction graph idle.';
        document.getElementById('reactionRoot').appendChild(m);
      });
  }

  // DAG (layered) — graceful if dag.json missing
  function initDagOnce() {
    if (!window.d3) {
      console.warn('D3 not loaded');

      return;
    }

    const svg = d3.select('#dagSvg');

    const g = svg.append('g');

    const linkG = g.append('g');

    const nodeG = g.append('g');

    const rootSel = document.getElementById('dagRootSel');

    const status = document.getElementById('dagStatus');

    const tip = document.getElementById('dagTip');

    const legendEl = document.getElementById('dagLegend');

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 2.5])
      .on('zoom', (ev) => g.attr('transform', ev.transform));

    svg.call(zoom);

    const typeFill = {
      host: '#e7f1ff',
      artifact: '#fff7db',
      vector: '#fff0c2',
      stage: '#f3f6f9',
      species: '#e9f7ef',
      hybrid: '#f9e6ef',
      agent: '#efefef',
      organism: '#f1f8ff',
      process: '#fbecff',
    };

    const edgeText = (k) =>
      ({
        reproduction: 'lays/produces',
        maturation: 'matures',
        implantation: 'implants',
        host: 'host',
        evolution: 'evolves',
        infection: 'infects',
        contaminate: 'contaminates',
        release: 'releases',
        parasite: 'parasitic outcome',
        biogenesis: 'forms egg',
        experiment: 'experiment',
        anomalous: 'anomalous birth',
        origin: 'origin',
        impregnation: 'impregnates',
        result: 'result',
        transmission: 'transmission',
        cloning: 'cloning',
      })[k] || k;

    function getSize() {
      const w = window.innerWidth,
        h = window.innerHeight - 52 - 52;

      return { width: Math.max(960, w), height: Math.max(600, h) };
    }

    // Draw Specimens legend (shapes + fills)
    function drawDagLegend() {
      if (!legendEl) return;
      const keys = ['host', 'agent', 'vector', 'artifact', 'stage', 'species', 'hybrid', 'process'];

      const wrap = document.createElement('div');

      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr 1fr';
      wrap.style.gap = '8px 16px';
      keys.forEach((k) => {
        const row = document.createElement('div');

        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        const icon = document.createElement('span');

        icon.style.display = 'inline-block';
        icon.style.width = '18px';
        icon.style.height = '18px';
        icon.style.background = typeFill[k] || '#fff';
        icon.style.border = '1.5px solid #222';

        if (k === 'process') {
          icon.style.borderRadius = '2px';
          icon.style.transform = 'rotate(45deg)';
        } else if (k === 'artifact') {
          icon.style.borderRadius = '4px';
        } else if (k === 'vector') {
          // approximate hexagon look
          icon.style.clipPath = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';
        } else {
          icon.style.borderRadius = '9999px';
        }

        const label = document.createElement('span');

        label.textContent = k;
        label.style.fontSize = '14px';
        row.appendChild(icon);
        row.appendChild(label);
        wrap.appendChild(row);
      });
      legendEl.innerHTML = '';
      legendEl.appendChild(wrap);
    }

    drawDagLegend();

    // All metadata is embedded in dag.json; no source augmentation needed

    fetch('dag.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('dag.json not found'))))
      .then((DATA) => {
        const current = DATA;

        const nodesAll = [
          ...(current.nodes || []),
          ...(current.processes || []).map((p) => ({
            id: p.id,
            type: 'process',
            source: p.source || null,
            image: p.image || null,
            description: p.description || '',
          })),
        ];

        // targets = species/hybrids + explicit finalProducts
        const targetsSet = new Set(
          nodesAll.filter((n) => n.type === 'species' || n.type === 'hybrid').map((n) => n.id)
        );

        (current.finalProducts || []).forEach((id) => targetsSet.add(id));
        const targets = Array.from(targetsSet);

        rootSel.innerHTML = '';
        targets.forEach((id, i) => {
          const opt = document.createElement('option');

          opt.value = id;
          opt.textContent = id;

          if (i === 0) opt.selected = true;
          rootSel.appendChild(opt);
        });
  rootSel.addEventListener('change', () => render(current, rootSel.value));

        let pinned = false,
          pinnedNode = null;

        // Define outer-scope unpin so event handlers can reference it
        function unpin() {
          pinned = false;
          pinnedNode = null;
          tip.style.opacity = 0;
          tip.style.pointerEvents = 'none';
        }

        svg.on('click', (ev) => {
          if (ev.target && ev.target.tagName === 'svg' && pinned) unpin();
        });
  tip.addEventListener('click', (e) => e.stopPropagation());

        function buildMaps(d) {
          const nodeMap = new Map(nodesAll.map((n) => [n.id, n]));

          const out = new Map(),
            inc = new Map();

          (d.links || []).forEach((e) => {
            if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) return;

            if (!out.has(e.source)) out.set(e.source, []);
            out.get(e.source).push(e);

            if (!inc.has(e.target)) inc.set(e.target, []);
            inc.get(e.target).push(e);
          });

          return { nodeMap, out, inc };
        }

        // Scoping predicates: like-for-like with reference
        const CLASSIC = new Set(['Drone', 'Warrior', 'Runner', 'Queen']);

        const PROTO = new Set(['Protomorph']);

        const NEWBORN = new Set(['Newborn']);

  const PATHOGEN = new Set(['Neomorph', 'Deacon', 'Hammerpede', 'Trilobite']);

        function allowedPredicateForTarget(targetId) {
          if (targetId === 'Cloned Queen (human DNA)') {
            const allow = new Set([
              'Queen',
              'Human',
              'Ellen Ripley (DNA)',
              'Cloning (Resurrection)',
              'Cloned Queen (human DNA)',
              'Queen live birth (clone context)',
              'Newborn',
            ]);

            return (id) => allow.has(id);
          }

          if (CLASSIC.has(targetId)) {
            if (targetId === 'Runner') {
              const allow = new Set([
                'Dog',
                'Ox',
                'Cocooned Victim',
                'Egg (Ovomorph)',
                'Facehugger',
                'Chestburster',
                'Mature (Quadruped host)',
                'Lay Egg',
                'Egg Morphing',
                'Hatch Normal',
                'Implantation: Facehugger + Dog',
                'Implantation: Facehugger + Ox',
                'Runner',
              ]);

              return (id) => allow.has(id);
            }

            if (targetId === 'Queen') {
              const allow = new Set([
                'Human',
                'Cocooned Victim',
                'Egg (Ovomorph)',
                'Facehugger',
                'Royal Facehugger',
                'Chestburster',
                'Praetorian',
                'Lay Egg',
                'Egg Morphing',
                'Hatch Normal',
                'Hatch Royal',
                'Royal Implantation (Queen embryo)',
                'Evolve: Drone → Praetorian',
                'Evolve: Praetorian → Queen',
                'Queen',
              ]);

              return (id) => allow.has(id);
            }

            const allow = new Set([
              'Human',
              'Cocooned Victim',
              'Egg (Ovomorph)',
              'Facehugger',
              'Chestburster',
              'Lay Egg',
              'Egg Morphing',
              'Hatch Normal',
              'Implantation: Facehugger + Human',
              'Mature (Human host)',
              'Drone',
              'Warrior',
            ]);

            return (id) => allow.has(id);
          }

          if (PROTO.has(targetId)) {
            const allow = new Set([
              'Black Goo',
              'Human',
              'Chestburster',
              'Experimental line',
              'Protomorph Egg',
              'Hatch (Proto)',
              'Proto-Facehugger',
              'Implantation: Proto-Facehugger + Human',
              'Mature (Proto host)',
              'Protomorph',
            ]);

            return (id) => allow.has(id);
          }

          if (NEWBORN.has(targetId)) {
            const allow = new Set([
              'Queen',
              'Human',
              'Cloning (Resurrection)',
              'Cloned Queen (human DNA)',
              'Queen live birth (clone context)',
              'Newborn',
            ]);

            return (id) => allow.has(id);
          }

          if (PATHOGEN.has(targetId)) {
            if (targetId === 'Neomorph') {
              const allow = new Set([
                'Black Goo',
                'Black Goo + Ecosystem',
                'Pods (contaminated)',
                'Pods release Spores',
                'Spores / Motes',
                'Spores infect Human',
                'Human',
                'Bloodburster',
                'Bloodburster → Neomorph',
                'Neomorph',
              ]);

              return (id) => allow.has(id);
            }

            if (targetId === 'Deacon') {
              const allow = new Set([
                'Black Goo',
                'Human',
                'Black Goo + Human',
                'Infected Human',
                'Parasitic transfer (sexual)',
                'Trilobite',
                'Engineer',
                'Trilobite + Engineer',
                'Deacon',
              ]);

              return (id) => allow.has(id);
            }

            if (targetId === 'Trilobite') {
              const allow = new Set([
                'Black Goo',
                'Human',
                'Black Goo + Human',
                'Infected Human',
                'Parasitic transfer (sexual)',
                'Trilobite',
              ]);

              return (id) => allow.has(id);
            }

            if (targetId === 'Hammerpede') {
              const allow = new Set(['Black Goo', 'Worms', 'Black Goo + Worms', 'Hammerpede']);

              return (id) => allow.has(id);
            }
          }

          if (targetId === 'Offspring') {
            const allow = new Set([
              'Black Goo',
              'Pregnant Human',
              'Experimental line',
              'Offspring',
            ]);

            return (id) => allow.has(id);
          }

          return () => true;
        }

        function buildSubgraph(d, targetId) {
          const { nodeMap, inc } = buildMaps(d);

          if (!nodeMap.has(targetId)) return { nodes: [], links: [] };
          const allow = allowedPredicateForTarget(targetId);

          if (!allow(targetId)) return { nodes: [], links: [] };
          const nodesSet = new Set([targetId]);

          const edges = [];

          const q = [targetId];

          while (q.length) {
            const v = q.shift();

            const ins = inc.get(v) || [];

            for (const e of ins) {
              if (!allow(e.source) || !allow(e.target)) continue;
              edges.push(e);

              if (!nodesSet.has(e.source)) {
                nodesSet.add(e.source);
                q.push(e.source);
              }
            }
          }

          const nodes = Array.from(nodesSet)
            .map((id) => nodeMap.get(id))
            .filter(Boolean);

          return { nodes, links: edges };
        }

        // Now that scoping is initialized, perform initial render
        render(current, targets[0] || (nodesAll[0] && nodesAll[0].id));

        function render(json, target) {
          const { width, height } = getSize();

          svg.attr('viewBox', `0 0 ${width} ${height}`);
          nodeG.selectAll('*').remove();
          linkG.selectAll('*').remove();

          const sub = buildSubgraph(json, target);

          const nodes = sub.nodes,
            links = sub.links;

          const nodeMap = new Map(nodes.map((n) => [n.id, n]));

          const out = new Map(),
            inc = new Map();

          links.forEach((e) => {
            if (!out.has(e.source)) out.set(e.source, []);
            out.get(e.source).push(e);

            if (!inc.has(e.target)) inc.set(e.target, []);
            inc.get(e.target).push(e);
          });

          const indeg = new Map(nodes.map((n) => [n.id, 0]));

          links.forEach((e) => indeg.set(e.target, (indeg.get(e.target) || 0) + 1));
          const seeds = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);

          const rank = new Map();

          const q = [...seeds];

          seeds.forEach((s) => rank.set(s, 0));

          while (q.length) {
            const u = q.shift();

            const ru = rank.get(u);

            (out.get(u) || []).forEach((e) => {
              const v = e.target;

              const rv = rank.has(v) ? rank.get(v) : Infinity;

              const nr = ru + 1;

              if (nr < rv) {
                rank.set(v, nr);
                q.push(v);
              }
            });
          }

          // Ensure target is rightmost column
          const maxRank = Array.from(rank.values()).reduce((a, b) => Math.max(a, b), 0);

          const tRank = rank.get(target) ?? maxRank;

          const shift = tRank < maxRank ? maxRank - tRank : 0;

          if (shift) {
            Array.from(rank.keys()).forEach((k) => rank.set(k, (rank.get(k) || 0) + shift));
          }

          const layered = d3.groups(nodes, (d) => rank.get(d.id) ?? 0).sort((a, b) => a[0] - b[0]);

          const colW = 220;

          const m = { top: 40, left: 40, right: 40, bottom: 40 };

          const xFor = (r) => m.left + r * colW;

          const layerHeights = layered.map(([rk, arr]) => ({
            rk,
            arr,
            spacing: (height - m.top - m.bottom) / (arr.length + 1),
          }));

          const pos = new Map();

          layerHeights.forEach(({ rk, arr, spacing }) => {
            arr.forEach((d, i) => {
              const x = xFor(rk),
                y = m.top + (i + 1) * spacing;

              pos.set(d.id, { x, y });
            });
          });
          const pathFor = (a, b) => {
            const p0 = pos.get(a),
              p1 = pos.get(b);

            const mx = (p0.x + p1.x) / 2;

            return `M${p0.x},${p0.y} C${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
          };

          const linkSel = linkG
            .selectAll('path.link')
            .data(links.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target)))
            .enter()
            .append('path')
            .attr('class', (e) =>
              (rank.get(e.target) ?? 0) <= (rank.get(e.source) ?? 0) ? 'link back' : 'link'
            )
            .attr('d', (e) => pathFor(e.source, e.target));

          const defs = svg.append('defs');

          defs
            .append('marker')
            .attr('id', 'dagArrow')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 10)
            .attr('refY', 5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M 0 0 L 10 5 L 0 10 z')
            .attr('fill', '#888');
          linkSel.attr('marker-end', 'url(#dagArrow)');

          linkG
            .selectAll('text.edge-label')
            .data(links)
            .enter()
            .append('text')
            .attr('class', 'edge-label')
            .attr('x', (e) => (pos.get(e.source).x + pos.get(e.target).x) / 2)
            .attr('y', (e) => (pos.get(e.source).y + pos.get(e.target).y) / 2 - 6)
            .text((e) => edgeText(e.kind));

          const nodeSel = nodeG
            .selectAll('g.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', (d) => `translate(${pos.get(d.id).x},${pos.get(d.id).y})`)
            .on('mousemove', (ev, d) => {
              if (!pinned) showTip(d, ev);
            })
            .on('mouseleave', () => {
              if (!pinned) hideTip();
            })
            .on('click', (ev, d) => pinTooltip(d, ev));

          nodeSel.each(function (d) {
            const sel = d3.select(this);

            const fill = typeFill[d.type] || '#fff';

            if (d.type === 'process') {
              sel
                .append('rect')
                .attr('x', -18)
                .attr('y', -18)
                .attr('width', 36)
                .attr('height', 36)
                .attr('transform', 'rotate(45)')
                .attr('fill', fill);
            } else if (d.type === 'artifact') {
              sel
                .append('rect')
                .attr('x', -36)
                .attr('y', -16)
                .attr('width', 72)
                .attr('height', 32)
                .attr('rx', 5)
                .attr('ry', 5)
                .attr('fill', fill);
            } else if (d.type === 'vector') {
              const r = 18;

              const pts = [
                [0, -r],
                [r * 0.866, -r * 0.5],
                [r * 0.866, r * 0.5],
                [0, r],
                [-r * 0.866, r * 0.5],
                [-r * 0.866, -r * 0.5],
              ];

              sel
                .append('polygon')
                .attr('points', pts.map((p) => p.join(',')).join(' '))
                .attr('fill', fill);
            } else {
              sel.append('circle').attr('r', 20).attr('fill', fill);
            }

            const text = sel.append('text').attr('class', 'label');

            const lines = wrapLabel(d.id, 10, 2);

            const lineH = 12;

            const oy = -((lines.length - 1) * lineH) / 2;

            lines.forEach((ln, i) =>
              text
                .append('tspan')
                .attr('x', 0)
                .attr('y', oy + i * lineH)
                .text(ln)
            );
          });

          function showTip(d, ev) {
            tip.innerHTML =
              `<b>${escapeHtml(d.id)}</b> <span class="pill">${escapeHtml(d.type || '')}</span>` +
              '<div style="margin-top:4px;color:#ddd">Click for details</div>';
            tip.style.left = `${ev.clientX + 12}px`;
            tip.style.top = `${ev.clientY + 12}px`;
            tip.style.opacity = 1;
          }

          function hideTip() {
            tip.style.opacity = 0;
          }

          function buildPinnedHtml(d) {
            const src = d.source
              ? `<div style="margin:6px 0 8px"><a href="${escapeHtml(d.source)}" target="_blank" rel="noopener">Open SOURCE →</a></div>`
              : '<div style="margin:6px 0 8px"><span>No source link</span></div>';

            const img = d.image
              ? `<div class="thumb" style="margin:6px 0 8px"><img alt="thumbnail" src="${escapeHtml(d.image)}" style="max-width:260px;border-radius:6px;border:1px solid #333"/></div>`
              : '';

            const body = `<div class="body" style="max-width:300px;line-height:1.35">${escapeHtml(d.description || 'No description.')}</div>`;

            return (
              `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><div><b>${escapeHtml(d.id)}</b> <span class="pill">${escapeHtml(d.type || '')}</span></div><button id="tipCloseBtn" aria-label="Close" style="border:none;background:#333;color:#fff;border-radius:12px;padding:2px 8px;cursor:pointer">×</button></div>` +
              src +
              img +
              body
            );
          }

          function pinTooltip(d, ev) {
            if (pinned && pinnedNode && pinnedNode.id === d.id) {
              unpin();

              return;
            }

            pinned = true;
            pinnedNode = d;
            const rectW = 320,
              rectH = 420;

            const px = Math.min(window.innerWidth - rectW - 8, ev.clientX + 12),
              py = Math.min(window.innerHeight - rectH - 8, ev.clientY + 12);

            tip.style.left = `${px}px`;
            tip.style.top = `${py}px`;
            tip.style.opacity = 1;
            tip.style.pointerEvents = 'auto';
            tip.innerHTML = buildPinnedHtml(d);
            bindClose();
          }

          function bindClose() {
            const btn = document.getElementById('tipCloseBtn');

            if (btn)
              btn.onclick = (e) => {
                e.stopPropagation();
                unpin();
              };
          }

          function unpin() {
            pinned = false;
            pinnedNode = null;
            tip.style.opacity = 0;
            tip.style.pointerEvents = 'none';
          }
        }

        function wrapLabel(s, maxChars, maxLines) {
          const words = String(s).split(/\s+/);

          const lines = [];

          let cur = '';

          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;

            if (test.length <= maxChars) {
              cur = test;
            } else {
              if (cur) lines.push(cur);
              cur = w;

              if (lines.length === maxLines - 1) break;
            }

            if (lines.length === maxLines - 1 && cur.length > maxChars) break;
          }

          if (cur && lines.length < maxLines) lines.push(cur);
          const leftover = words.slice(lines.join(' ').split(/\s+/).length).length;

          if (leftover > 0 && lines.length) {
            const last = lines[lines.length - 1];

            lines[lines.length - 1] =
              (last.length > 1 ? last.slice(0, Math.max(1, maxChars - 1)) : last) + '…';
          }

          return lines.length ? lines : [String(s).slice(0, maxChars - 1) + '…'];
        }

        window.addEventListener('resize', () => {
          const { width, height } = getSize();

          svg.attr('viewBox', `0 0 ${width} ${height}`);
        });

        // No runtime fetching; tooltips read from dag.json only
      })
      .catch((err) => {
        status.textContent = `${err.message} — DAG view idle.`;
      });
  }

  // UX: focus search with '/'
  window.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      const el = document.getElementById('reactionSearch');

      if (el) {
        el.focus();
        e.preventDefault();
      }
    }
  });
})();
