/*
    Accessibility checks (axe-core in headless Chrome) for every page, in dark and light mode, at desktop and
    phone widths.  On the Home and Advanced pages it also loads the sample comments file and checks the page
    again in each state: list loaded, a choice still to make, feedback generated, edit mode, editing, delete
    confirmation and (Advanced) a student with a draft.

    Run with:  npm run test:a11y      (exits with an error if any violation is found)
    CHROME_PATH=/path/to/chrome can be set to use an existing Chrome instead of the downloaded one.
*/
const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require('puppeteer-core'); }

const root = path.resolve(__dirname, '..');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const sampleFeedback = path.join(root, 'samples', 'sample-feedback.txt');
const sampleClassList = path.join(root, 'samples', 'sample-class-list.txt');

let failures = 0;

async function check(page, label) {
    //transient status messages fade in and out, which would make colour checks unreliable
    await sleep(600);
    await page.evaluate(() => document.querySelectorAll('[role=status]').forEach(e => { e.textContent = ''; e.className = ''; }));
    await page.evaluate(axeSource);
    const result = await page.evaluate(t => axe.run(document, { runOnly: { type: 'tag', values: t } }), tags);
    if (result.violations.length) {
        failures += result.violations.length;
        console.log('FAIL', label);
        result.violations.forEach(v => console.log('   -', v.id + ':', v.help, '\n     ', v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')));
    } else {
        console.log('ok  ', label);
    }
}

async function loadFeedbackFile(page) {
    const [chooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('label:has(#fileSelector)')
    ]);
    await chooser.accept([sampleFeedback]);
    await sleep(500);
}

async function exerciseStates(page, name, label) {
    if (name === 'advanced') {
        const input = await page.$('#classListFile');
        await input.uploadFile(sampleClassList);
        await sleep(400);
    }
    await loadFeedbackFile(page);
    await check(page, label + ' / list loaded');

    //tick a comment that has a drop-down but don't choose: Generate should flag it
    const entry = await page.$eval('select.modifier', s => s.dataset.entry);
    await page.click('#check' + entry);
    await page.click('#generate');
    await sleep(300);
    await check(page, label + ' / choice needed');

    await page.select('select.modifier', '0');
    await page.click('#generate');
    await check(page, label + ' / feedback generated');

    await page.click('#editModeToggle');
    await check(page, label + ' / edit mode');

    await page.click('.edit-comment');
    await check(page, label + ' / editing a comment');
    await page.keyboard.press('Escape');

    await page.click('.delete-comment');
    await check(page, label + ' / delete confirmation');
    await page.click('.delete-no');

    await page.click('#addSectionToggle');
    await check(page, label + ' / add section form');

    if (name === 'advanced') {
        await page.evaluate(() => document.querySelectorAll('#studentBox .student-row')[1].querySelector('span').click());
        await sleep(200);
        await check(page, label + ' / student with a draft');
    }
}

(async () => {
    const launch = { args: ['--no-sandbox'] };
    if (process.env.CHROME_PATH) { launch.executablePath = process.env.CHROME_PATH; }
    const browser = await puppeteer.launch(launch);

    for (const theme of ['dark', 'light']) {
        for (const width of [1200, 380]) {
            for (const name of ['index', 'advanced', 'instructions', 'privacy', 'about']) {
                const page = await browser.newPage();
                page.on('dialog', d => d.accept());                  //"unsaved changes" prompts
                page.on('pageerror', e => { failures++; console.log('FAIL page error on', name + ':', e.message); });
                await page.setViewport({ width, height: 1000 });
                await page.evaluateOnNewDocument(t => {
                    localStorage.setItem('theme', t);
                    delete window.showOpenFilePicker;                //use the ordinary file input in tests
                }, theme);
                await page.goto('file://' + path.join(root, name + '.html'));

                const label = `${name} (${theme}, ${width}px)`;
                await check(page, label);
                if (name === 'index' || name === 'advanced') { await exerciseStates(page, name, label); }
                await page.close();
            }
        }
    }

    await browser.close();
    if (failures) { console.error(`\n${failures} problem(s) found`); process.exit(1); }
    console.log('\nAll accessibility checks passed');
})().catch(e => { console.error(e); process.exit(1); });
