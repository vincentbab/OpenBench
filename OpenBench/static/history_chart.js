const HC = { id: null, data: null, view: null, last: 0 };

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg_el(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(el);
    return el;
}

function nice_step(span, count) {
    const raw = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
}

function ticks(min, max, count) {
    const step = nice_step(max - min, count);
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step)
        out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
}

function format_games(value) {
    if (value >= 1000000) return (value / 1000000).toFixed(value % 1000000 ? 1 : 0) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(value % 1000 ? 1 : 0) + 'k';
    return String(value);
}

function sign_class(value) {
    return value > 0 ? 'pos' : value < 0 ? 'neg' : '';
}

function format_signed(value, digits) {
    return (value > 0 ? '+' : '') + value.toFixed(digits);
}

function history_points() {
    const data = HC.data;
    const points = data.history.slice();
    const total = Math.max(data.games, points.length ? points[points.length - 1].games : 0);
    const from_start = points.length && (points[0].games <= Math.max(2000, total * 0.05));
    if (from_start && points[0].games > 0)
        points.unshift({ games: 0, llr: 0, elo: 0, elo_error: 0, origin: true });
    return { points, total, from_start };
}

function render_history() {

    const container = document.getElementById('history-chart');
    const note = document.getElementById('history-note');
    if (!container || !HC.data) return;

    container.replaceChildren();
    note.textContent = '';

    const { points, total, from_start } = history_points();
    const recorded = points.filter(p => !p.origin);

    document.getElementById('history-card').classList.toggle('no-history', !recorded.length);

    if (!recorded.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = '<i class="fa-solid fa-chart-line"></i>';
        empty.appendChild(document.createTextNode('No history recorded for this test.'));
        container.appendChild(empty);
        return;
    }

    if (!from_start)
        note.textContent = 'History recorded from ' + recorded[0].games.toLocaleString() + ' games';

    if (HC.view === 'table')
        return render_history_table(container, recorded);

    const is_llr = HC.view === 'llr';
    const series = is_llr ? points : recorded;

    const width = Math.max(320, container.clientWidth);
    const height = 260;
    const m = { top: 14, right: is_llr ? 76 : 20, bottom: 30, left: 52 };
    const pw = width - m.left - m.right;
    const ph = height - m.top - m.bottom;

    const x_max = Math.max(total, 1);
    let y_min, y_max;

    if (is_llr) {
        y_min = Math.min(HC.data.lowerllr, ...series.map(p => p.llr));
        y_max = Math.max(HC.data.upperllr, ...series.map(p => p.llr));
    } else {
        const settled = series.filter(p => p.games >= x_max * 0.1);
        const basis = settled.length >= 2 ? settled : series;
        y_min = Math.min(0, ...series.map(p => p.elo), ...basis.map(p => p.elo - p.elo_error));
        y_max = Math.max(0, ...series.map(p => p.elo), ...basis.map(p => p.elo + p.elo_error));
    }

    const pad = (y_max - y_min) * 0.08 || 1;
    y_min -= pad;
    y_max += pad;

    const sx = g => m.left + (g / x_max) * pw;
    const sy = v => m.top + (1 - (v - y_min) / (y_max - y_min)) * ph;

    const svg = svg_el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'history-svg', role: 'img',
        'aria-label': (is_llr ? 'LLR' : 'Elo') + ' history over ' + total + ' games' }, container);

    const defs = svg_el('defs', {}, svg);
    const clip_id = 'history-clip';
    const clip = svg_el('clipPath', { id: clip_id }, defs);
    svg_el('rect', { x: m.left, y: m.top, width: pw, height: ph }, clip);

    const zero = Math.min(1, Math.max(0, (sy(0) - m.top) / ph));
    const sign = svg_el('linearGradient', { id: 'hc-sign', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: m.top, y2: m.top + ph }, defs);
    svg_el('stop', { offset: zero, style: 'stop-color: var(--pass)' }, sign);
    svg_el('stop', { offset: zero, style: 'stop-color: var(--fail)' }, sign);

    const grid = svg_el('g', { class: 'hc-grid' }, svg);
    ticks(y_min, y_max, 5).forEach(v => {
        svg_el('line', { x1: m.left, x2: m.left + pw, y1: sy(v), y2: sy(v) }, grid);
        const label = svg_el('text', { x: m.left - 8, y: sy(v), class: 'hc-tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
        label.textContent = is_llr ? v.toFixed(Math.abs(v) < 10 ? 1 : 0) : format_signed(v, Math.abs(v) < 10 ? 1 : 0);
    });

    ticks(0, x_max, Math.max(2, Math.floor(pw / 90))).forEach(g => {
        const label = svg_el('text', { x: sx(g), y: m.top + ph + 20, class: 'hc-tick', 'text-anchor': 'middle' }, svg);
        label.textContent = format_games(g);
    });

    svg_el('line', { x1: m.left, x2: m.left + pw, y1: sy(0), y2: sy(0), class: 'hc-zero' }, svg);

    if (is_llr) {
        [[HC.data.upperllr, 'H1 ' + HC.data.upperllr.toFixed(2)], [HC.data.lowerllr, 'H0 ' + HC.data.lowerllr.toFixed(2)]].forEach(([value, text]) => {
            svg_el('line', { x1: m.left, x2: m.left + pw, y1: sy(value), y2: sy(value), class: 'hc-bound' }, svg);
            const label = svg_el('text', { x: m.left + pw + 8, y: sy(value), class: 'hc-bound-label', 'dominant-baseline': 'middle' }, svg);
            label.textContent = text;
        });
    }

    const plot = svg_el('g', { 'clip-path': `url(#${clip_id})` }, svg);

    if (!is_llr && series.length > 1) {
        const upper = series.map(p => `${sx(p.games)},${sy(p.elo + p.elo_error)}`);
        const lower = series.slice().reverse().map(p => `${sx(p.games)},${sy(p.elo - p.elo_error)}`);
        svg_el('path', { d: 'M' + upper.join('L') + 'L' + lower.join('L') + 'Z', class: 'hc-band' }, plot);
    }

    const value = p => is_llr ? p.llr : p.elo;
    svg_el('path', { d: 'M' + series.map(p => `${sx(p.games)},${sy(value(p))}`).join('L'), class: 'hc-line' }, plot);

    const last = series[series.length - 1];
    svg_el('circle', { cx: sx(last.games), cy: sy(value(last)), r: 4, class: 'hc-dot ' + sign_class(value(last)) }, svg);

    const cross = svg_el('line', { y1: m.top, y2: m.top + ph, class: 'hc-cross', visibility: 'hidden' }, svg);
    const focus = svg_el('circle', { r: 4, class: 'hc-dot', visibility: 'hidden' }, svg);
    const hit = svg_el('rect', { x: m.left, y: m.top, width: pw, height: ph, fill: 'transparent', tabindex: 0 }, svg);

    const tooltip = document.createElement('div');
    tooltip.className = 'hc-tooltip hidden';
    container.appendChild(tooltip);

    function show(index) {
        const p = series[index];
        const x = sx(p.games), y = sy(value(p));
        cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
        focus.setAttribute('cx', x); focus.setAttribute('cy', y); focus.setAttribute('visibility', 'visible');
        focus.setAttribute('class', 'hc-dot ' + sign_class(value(p)));

        tooltip.replaceChildren();
        const rows = [['Games', p.games.toLocaleString(), '']];
        if (HC.data.mode === 'SPRT') rows.push(['LLR', p.llr.toFixed(2), sign_class(p.llr)]);
        if (!p.origin) rows.push(['Elo', format_signed(p.elo, 2) + ' ± ' + p.elo_error.toFixed(2), sign_class(p.elo)]);
        rows.forEach(([label, text, cls]) => {
            const row = document.createElement('div');
            const strong = document.createElement('b');
            strong.textContent = text;
            if (cls) strong.className = 'value ' + cls;
            const span = document.createElement('span');
            span.textContent = label;
            row.append(strong, span);
            tooltip.appendChild(row);
        });

        tooltip.classList.remove('hidden');
        const left = x + 12 + tooltip.offsetWidth > width ? x - 12 - tooltip.offsetWidth : x + 12;
        tooltip.style.left = left + 'px';
        tooltip.style.top = Math.max(0, Math.min(height - tooltip.offsetHeight, y - tooltip.offsetHeight / 2)) + 'px';
    }

    function nearest(games) {
        let lo = 0, hi = series.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (series[mid].games < games) lo = mid; else hi = mid;
        }
        return Math.abs(series[lo].games - games) <= Math.abs(series[hi].games - games) ? lo : hi;
    }

    let current = series.length - 1;

    hit.addEventListener('pointermove', event => {
        const rect = svg.getBoundingClientRect();
        current = nearest(((event.clientX - rect.left) - m.left) / pw * x_max);
        show(current);
    });

    hit.addEventListener('pointerleave', () => {
        cross.setAttribute('visibility', 'hidden');
        focus.setAttribute('visibility', 'hidden');
        tooltip.classList.add('hidden');
    });

    hit.addEventListener('focus', () => show(current));
    hit.addEventListener('blur', () => hit.dispatchEvent(new Event('pointerleave')));
    hit.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') current = Math.max(0, current - 1);
        else if (event.key === 'ArrowRight') current = Math.min(series.length - 1, current + 1);
        else return;
        event.preventDefault();
        show(current);
    });
}

function render_history_table(container, points) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap history-table';
    const table = document.createElement('table');
    table.className = 'table table-compact';

    const head = document.createElement('tr');
    const columns = HC.data.mode === 'SPRT' ? ['Games', 'LLR', 'Elo', '±'] : ['Games', 'Elo', '±'];
    columns.forEach(name => {
        const th = document.createElement('th');
        th.className = 'num';
        th.textContent = name;
        head.appendChild(th);
    });
    table.createTHead().appendChild(head);

    const body = table.createTBody();
    points.slice().reverse().forEach(p => {
        const tr = body.insertRow();
        const values = [[p.games.toLocaleString(), '']];
        if (HC.data.mode === 'SPRT') values.push([p.llr.toFixed(2), sign_class(p.llr)]);
        values.push([format_signed(p.elo, 2), sign_class(p.elo)], [p.elo_error.toFixed(2), '']);
        values.forEach(([text, cls]) => {
            const td = tr.insertCell();
            td.className = 'num' + (cls ? ' value ' + cls : '');
            td.textContent = text;
        });
    });

    wrap.appendChild(table);
    container.appendChild(wrap);
}

async function fetch_history() {
    const response = await fetch(`/api/workload/${HC.id}/history/`, { cache: 'no-store' });
    HC.data = await response.json();
    HC.last = Date.now();
    render_history();
}

function init_history(workload_id) {

    const card = document.getElementById('history-card');
    if (!card) return;

    HC.id = workload_id;

    card.querySelectorAll('[data-history-view]').forEach(button => {
        if (button.classList.contains('active')) HC.view = button.dataset.historyView;
        button.addEventListener('click', () => {
            card.querySelectorAll('[data-history-view]').forEach(b => b.classList.toggle('active', b === button));
            HC.view = button.dataset.historyView;
            render_history();
        });
    });

    fetch_history();

    let width = 0;
    new ResizeObserver(entries => {
        const w = Math.round(entries[0].contentRect.width);
        if (w !== width) { width = w; render_history(); }
    }).observe(document.getElementById('history-chart'));

    document.addEventListener('live:updated', () => {
        if (Date.now() - HC.last > 10000) fetch_history();
    });
}
