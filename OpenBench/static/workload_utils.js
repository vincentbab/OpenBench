const WL = { id: null, running: false, results: false, digest: false, last_summary: 0 };

function copy_statblock() {
    const text = document.getElementById('long-statblock').textContent.trim();
    OB.copy(text, 'Stat block copied');
}

function cell(tag, text, class_name) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (class_name) el.className = class_name;
    return el;
}

function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function populate_results(results) {

    const container = document.getElementById('results-container');
    container.innerHTML = '';

    let active = 0;

    results.forEach(result => {
        const tr = document.createElement('tr');
        if (result.active) {
            tr.classList.add('is-active');
            active++;
        }

        const penta = [result.LL, result.LD, result.DD, result.DW, result.WW];
        const pairs = penta.reduce((a, b) => a + b, 0);

        const id = document.createElement('td');
        const link = document.createElement('a');
        link.href = `/machines/${result.machine__id}/`;
        link.textContent = result.machine__id;
        id.appendChild(link);

        tr.appendChild(id);
        tr.appendChild(cell('td', capitalize(result.machine__user__username)));
        tr.appendChild(cell('td', result.games.toLocaleString(), 'num'));
        tr.appendChild(cell('td', `(${penta.join(', ')})`, 'mono'));
        tr.appendChild(cell('td', pairs.toLocaleString(), 'num'));
        tr.appendChild(cell('td', result.timeloss, 'num'));
        tr.appendChild(cell('td', result.crashes, 'num' + (result.crashes ? ' value neg' : '')));

        container.appendChild(tr);
    });

    if (!results.length) {
        const tr = document.createElement('tr');
        const td = cell('td', 'No machine has reported results yet', 'empty');
        td.colSpan = 7;
        tr.appendChild(td);
        container.appendChild(tr);
    }

    document.getElementById('results-count').textContent =
        `${results.length} machine${results.length === 1 ? '' : 's'}` + (active ? ` · ${active} active` : '');
}

async function fetch_results(workload_id) {
    const response = await fetch(`/api/workload/${workload_id}/results/`, { cache: 'no-store' });
    const data = await response.json();
    populate_results(data.results);
    WL.results = true;
    document.getElementById('results-table').classList.remove('hidden');
    document.getElementById('results-button').classList.add('hidden');
}

function format_cpu_name(name) {
    name = name.replace(/\(R\)|\(TM\)/gi, '');
    if (/Intel/.test(name) && /Xeon/.test(name)) name = name.replace(/Intel/g, '');
    if (/AMD/.test(name) && /EPYC|Ryzen/.test(name)) name = name.replace(/AMD/g, '');
    name = name.replace(/Processor|CPU/g, '').replace(/\d+-Core/gi, '');
    return name.replace(/\s+/g, ' ').trim();
}

function summary_table(label, rows, key_formatter) {

    const has_nps = rows.some(row => row.dev_nps > 0);
    const table = document.createElement('table');
    table.className = 'table table-compact summary-table';

    const widths = has_nps ? [22, 22, 12, 8, 7, 14, 15] : [30, 30, 16, 12, 12];
    const colgroup = document.createElement('colgroup');
    widths.forEach(width => {
        const col = document.createElement('col');
        col.style.width = width + '%';
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    [label, 'Penta', 'Elo', 'Pairs', '%'].forEach((name, i) => head.appendChild(cell('th', name, i >= 2 ? 'num' : '')));
    if (has_nps) {
        head.appendChild(cell('th', 'KNPS', 'num'));
        head.appendChild(cell('th', 'Scaled KNPS', 'num'));
    }
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const knps = nps => (nps / 1000.0).toFixed(1);

    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.appendChild(cell('td', key_formatter ? key_formatter(row.key) : row.key));
        tr.appendChild(cell('td', row.penta, 'mono'));
        tr.appendChild(cell('td', row.elo, 'num nowrap'));
        tr.appendChild(cell('td', row.pairs.toLocaleString(), 'num'));
        tr.appendChild(cell('td', row.percent, 'num'));
        if (has_nps) {
            tr.appendChild(cell('td', `${knps(row.dev_nps)} / ${knps(row.base_nps)}`, 'num nowrap'));
            tr.appendChild(cell('td', `${knps(row.dev_nps_scaled)} / ${knps(row.base_nps_scaled)}`, 'num nowrap'));
        }
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
}

async function fetch_summary(workload_id) {

    const response = await fetch(`/api/workload/${workload_id}/summary/`, { cache: 'no-store' });
    const data = await response.json();
    const container = document.getElementById('summary-container');

    WL.last_summary = Date.now();

    if (!data.summary || !data.summary.user.length) {
        container.innerHTML = '<div class="empty"><i class="fa-regular fa-hourglass"></i>No results yet</div>';
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(summary_table('User', data.summary.user, capitalize));
    wrap.appendChild(summary_table('CPU', data.summary.cpu_name, format_cpu_name));
    wrap.appendChild(summary_table('ISA', data.summary.isa_name));

    container.replaceChildren(wrap);
}

async function copy_spsa_inputs(workload_id) {
    const response = await fetch(`/api/spsa/${workload_id}/inputs/`);
    OB.copy(await response.text(), 'SPSA inputs copied');
}

async function copy_spsa_outputs(workload_id) {
    const response = await fetch(`/api/spsa/${workload_id}/outputs/`);
    OB.copy(await response.text(), 'SPSA outputs copied');
}

async function fetch_spsa_digest(workload_id) {

    const response = await fetch(`/api/spsa/${workload_id}/digest/`, { cache: 'no-store' });
    const lines = (await response.text()).trim().split('\n');
    const tbody = document.getElementById('spsa-digest-body-container');

    tbody.innerHTML = '';

    for (let i = 1; i < lines.length; i++) {
        const tr = document.createElement('tr');
        lines[i].split(',').forEach((value, j) => tr.appendChild(cell('td', value, j ? 'num mono' : 'mono')));
        tbody.appendChild(tr);
    }

    WL.digest = true;
    document.getElementById('spsa-digest-button-container').classList.add('hidden');
}

function init_workload(workload_id, running) {

    WL.id = workload_id;
    WL.running = running;

    fetch_summary(workload_id);

    document.addEventListener('live:updated', () => {
        if (Date.now() - WL.last_summary > 15000) fetch_summary(WL.id);
        if (WL.results) fetch_results(WL.id);
        if (WL.digest) fetch_spsa_digest(WL.id);
    });
}
