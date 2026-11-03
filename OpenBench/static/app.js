(function () {

    const OB = window.OB = window.OB || {};

    const DATE_TIME = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const DATE_SHORT = { month: 'short', day: '2-digit' };

    function relative_time(date) {
        const seconds = Math.round((Date.now() - date.getTime()) / 1000);
        const units = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        let value = seconds;
        for (const [size, unit] of units) {
            if (Math.abs(value) < size) return rtf.format(-value, unit);
            value = Math.round(value / size);
        }
    }

    function hydrate(root) {

        root.querySelectorAll('.timestamp:not([data-ts])').forEach(el => {
            const date = new Date(1000 * el.textContent.trim());
            el.dataset.ts = el.textContent.trim();
            el.textContent = date.toLocaleString(undefined, DATE_TIME);
        });

        root.querySelectorAll('.datestamp:not([data-ts])').forEach(el => {
            const date = new Date(1000 * el.textContent.trim());
            el.dataset.ts = el.textContent.trim();
            el.title = date.toLocaleString(undefined, DATE_TIME);
            el.textContent = date.toLocaleString(undefined, DATE_SHORT);
        });

        root.querySelectorAll('.reltime').forEach(el => {
            if (!el.dataset.ts) el.dataset.ts = el.textContent.trim();
            const date = new Date(1000 * el.dataset.ts);
            el.title = date.toLocaleString(undefined, DATE_TIME);
            el.textContent = relative_time(date);
        });

        root.querySelectorAll('.engine-options:not([data-done])').forEach(el => {
            el.dataset.done = '1';
            const text = el.textContent.trim();
            if (text.split(/\s+/).length <= 2) return;
            const threads = (text.match(/Threads=\d+/) || [''])[0];
            const hash = (text.match(/Hash=\d+/) || [''])[0];
            const pop = document.createElement('span');
            pop.className = 'opt-pop';
            pop.textContent = [threads, hash, '…'].filter(Boolean).join(' ');
            const body = document.createElement('span');
            body.className = 'opt-pop-body';
            body.textContent = text.replace(/\s+/g, '\n');
            pop.appendChild(body);
            el.textContent = '';
            el.appendChild(pop);
        });
    }

    const SORTS = {};

    function sort_key(table) {
        return 'ob-sort:' + window.location.pathname + ':' + table.id;
    }

    function sort_table(table, column, direction) {
        const th = table.tHead.rows[0].cells[column];
        const numeric = th.dataset.sort === 'num';
        const tbody = table.tBodies[0];
        const value = row => {
            const cell = row.cells[column];
            if (!cell) return '';
            const raw = cell.dataset.sort !== undefined ? cell.dataset.sort : cell.textContent.trim();
            return numeric ? (parseFloat(raw.replace(/,/g, '')) || 0) : raw;
        };
        const rows = Array.from(tbody.rows);
        rows.sort((a, b) => {
            const x = value(a), y = value(b);
            const cmp = numeric ? x - y : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
            return direction === 'asc' ? cmp : -cmp;
        });
        rows.forEach(row => tbody.appendChild(row));

        table.querySelectorAll('th[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    function setup_sortable(root) {
        root.querySelectorAll('table[data-sortable]').forEach(table => {
            if (!table.id || !table.tHead || !table.tBodies.length) return;

            table.querySelectorAll('th[data-sort]').forEach(th => {
                th.classList.add('sortable');
                th.onclick = () => {
                    const current = SORTS[table.id];
                    const numeric = th.dataset.sort === 'num';
                    const direction = current && current.column === th.cellIndex
                        ? (current.direction === 'asc' ? 'desc' : 'asc')
                        : (numeric ? 'desc' : 'asc');
                    SORTS[table.id] = { column: th.cellIndex, direction: direction };
                    try { localStorage.setItem(sort_key(table), JSON.stringify(SORTS[table.id])); } catch (err) {}
                    sort_table(table, th.cellIndex, direction);
                };
            });

            if (!SORTS[table.id]) {
                try { SORTS[table.id] = JSON.parse(localStorage.getItem(sort_key(table))); } catch (err) {}
            }

            const state = SORTS[table.id];
            if (state && table.tHead.rows[0].cells[state.column]) sort_table(table, state.column, state.direction);
        });
    }

    OB.hydrate = function (root) {
        hydrate(root);
        setup_sortable(root);
    };

    OB.toast = function (message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
    };

    OB.copy = async function (text, message) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        OB.toast(message || 'Copied to clipboard');
    };

    function setup_theme() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        button.addEventListener('click', () => {
            const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('ob-theme', next); } catch (err) {}
        });
    }

    function setup_dropdowns() {

        document.addEventListener('click', event => {
            const trigger = event.target.closest('[data-dropdown]');
            const current = trigger ? trigger.closest('.dropdown') : null;

            document.querySelectorAll('.dropdown.open').forEach(dd => {
                if (dd !== current && !dd.contains(event.target)) dd.classList.remove('open');
            });

            if (current) {
                event.preventDefault();
                current.classList.toggle('open');
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.dropdown.open').forEach(dd => dd.classList.remove('open'));
                document.body.classList.remove('nav-open');
            }
        });

        const burger = document.getElementById('nav-burger');
        if (burger) burger.addEventListener('click', () => document.body.classList.toggle('nav-open'));

        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) backdrop.addEventListener('click', () => document.body.classList.remove('nav-open'));
    }

    function setup_search() {
        const form = document.getElementById('nav-search');
        if (!form) return;
        const input = form.querySelector('input');

        form.addEventListener('submit', event => {
            const value = input.value.trim().replace(/^#/, '');
            if (/^\d+$/.test(value)) {
                event.preventDefault();
                window.location.href = '/test/' + value + '/';
            } else if (!value) {
                event.preventDefault();
                window.location.href = '/search/';
            }
        });

        document.addEventListener('keydown', event => {
            const tag = (event.target.tagName || '').toLowerCase();
            if (event.key === '/' && !['input', 'textarea', 'select'].includes(tag) && !event.target.isContentEditable) {
                event.preventDefault();
                input.focus();
                input.select();
            }
        });
    }

    function setup_forms() {

        document.addEventListener('submit', event => {
            const form = event.target;
            if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
                event.preventDefault();
                return;
            }
            if (form.dataset.submitting) {
                event.preventDefault();
                return;
            }
            form.dataset.submitting = '1';
            form.querySelectorAll('[type="submit"]').forEach(btn => btn.classList.add('disabled'));
        }, true);

        window.addEventListener('pageshow', event => {
            if (!event.persisted) return;
            document.querySelectorAll('form[data-submitting]').forEach(form => {
                delete form.dataset.submitting;
                form.querySelectorAll('[type="submit"]').forEach(btn => btn.classList.remove('disabled'));
            });
        });

        document.addEventListener('click', event => {
            const link = event.target.closest('a[data-confirm]');
            if (link && !window.confirm(link.dataset.confirm)) event.preventDefault();

            const copy = event.target.closest('[data-copy]');
            if (copy) {
                event.preventDefault();
                OB.copy(copy.dataset.copy, copy.dataset.copyMessage);
            }

            const close = event.target.closest('.alert-close');
            if (close) close.closest('.alert').remove();
        });
    }

    function live_signature(html) {
        return html.replace(/<input[^>]*csrfmiddlewaretoken[^>]*>/g, '');
    }

    function setup_live() {

        const main = document.querySelector('main[data-live-interval]');
        if (!main || !document.querySelector('[data-live]')) return;

        const interval = parseInt(main.dataset.liveInterval, 10) || 10000;

        let timer = null;
        let stopped = false;
        let inflight = false;
        let state = { paused: false, text: 'Live' };

        function set_state(paused, text) {
            state = { paused, text };
            const indicator = document.getElementById('live-indicator');
            if (!indicator) return;
            indicator.classList.toggle('paused', paused);
            const label = indicator.querySelector('.live-label');
            if (label) label.textContent = text;
        }

        async function refresh() {
            if (inflight || stopped) return;
            inflight = true;

            try {
                const response = await fetch(window.location.href, { headers: { 'X-Live': '1' }, cache: 'no-store', credentials: 'same-origin' });

                if (response.redirected && /\/login\/?/.test(new URL(response.url).pathname)) {
                    window.location.reload();
                    return;
                }

                if (!response.ok) throw new Error(response.status);

                const doc = new DOMParser().parseFromString(await response.text(), 'text/html');

                document.querySelectorAll('[data-live]').forEach(region => {
                    const fresh = doc.getElementById(region.id);
                    if (!fresh) return;
                    if (region.contains(document.activeElement) && document.activeElement !== document.body) return;
                    if (region.dataset.liveHtml === live_signature(fresh.innerHTML)) return;

                    region.dataset.liveHtml = live_signature(fresh.innerHTML);
                    region.innerHTML = fresh.innerHTML;
                    OB.hydrate(region);
                    set_state(state.paused, state.text);
                    region.classList.remove('is-updated');
                    void region.offsetWidth;
                    region.classList.add('is-updated');
                });

                if (doc.title) document.title = doc.title;

                set_state(false, 'Live');
                document.dispatchEvent(new CustomEvent('live:updated'));

                const fresh_main = doc.querySelector('main');
                if (fresh_main && !fresh_main.hasAttribute('data-live-interval')) {
                    stopped = true;
                    clearInterval(timer);
                    set_state(true, 'Finished');
                }

            } catch (err) {
                set_state(true, 'Offline');
            } finally {
                inflight = false;
            }
        }

        function start() {
            if (stopped) return;
            clearInterval(timer);
            timer = setInterval(refresh, interval);
        }


        document.addEventListener('visibilitychange', () => {
            if (stopped) return;
            if (document.hidden) {
                clearInterval(timer);
                set_state(true, 'Paused');
            } else {
                refresh();
                start();
            }
        });

        set_state(false, 'Live');
        start();

        OB.refresh = refresh;
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-live]').forEach(region => region.dataset.liveHtml = live_signature(region.innerHTML));
        OB.hydrate(document);
        setup_theme();
        setup_dropdowns();
        setup_search();
        setup_forms();
        setup_live();
        setInterval(() => hydrate(document), 30000);
    });

})();
