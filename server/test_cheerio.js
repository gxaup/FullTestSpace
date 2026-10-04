import fs from 'fs';
import * as cheerio from 'cheerio';

const login = async () => {
    try {
        const fetch = global.fetch;
        const res = await fetch('http://localhost:3001/api/countif/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: 'fvazquez', password: 'Topview12345'})
        });
        const data = await res.json();
        
        if (data.success) {
            const REPORT_URL = 'https://www.countif.net/Administration/Reports/DispatchReport.aspx';
            const pageRes = await fetch(REPORT_URL, { headers: { 'Cookie': data.result.sessionCookie } });
            const pageHtml = await pageRes.text();
            
            const $ = cheerio.load(pageHtml);
            const params = new URLSearchParams();
            
            // Extract ALL input, select, and textarea fields initially to mirror the browser's form serialization exactly
            $('input, select, textarea').each((i, el) => {
                const name = $(el).attr('name');
                const value = $(el).val() || '';
                const type = $(el).attr('type');
                
                if (name) {
                    // Skip submit buttons unless it's the one we are explicitly clicking
                    if (type === 'submit' || type === 'button') return;
                    
                    // For select multiple, skip for now, we'll manually append them if needed or grab the first selected
                    if ($(el).is('select') && $(el).attr('multiple')) {
                         $(el).find('option[selected]').each((j, opt) => {
                             params.append(name, $(opt).attr('value'));
                         });
                         // if none selected, we don't append, wait, we need to select all dispatch types
                         if (name === 'ctl00$MainContent$lstDispatchTypes') {
                             ['1','101','2','3','4','104','7','8','9'].forEach(t => params.append(name, t));
                         }
                         return;
                    }

                    // For select single
                    if ($(el).is('select') && !$(el).attr('multiple')) {
                        const selectedVal = $(el).find('option[selected]').attr('value') || $(el).find('option').first().attr('value') || '';
                        params.append(name, selectedVal);
                        return;
                    }
                    
                    params.append(name, value);
                }
            });
            
            // Add our trigger button
            params.append('ctl00$MainContent$btnSearch', 'Search');

            // Hardcode EventTargets
            params.delete('__EVENTTARGET');
            params.delete('__EVENTARGUMENT');
            params.append('__EVENTTARGET', '');
            params.append('__EVENTARGUMENT', '');
            
            console.log('Sending Params Keys Count:', Array.from(params.keys()).length);

            const postRes = await fetch(REPORT_URL, {
              method: 'POST',
              headers: {
                'Cookie': data.result.sessionCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
              },
              body: params.toString(),
              redirect: 'manual'
            });
            
            const postHtml = await postRes.text();
            fs.writeFileSync('cheerio_dump.html', postHtml);
            console.log('Post Status:', postRes.status);
            console.log('HTML Length:', postHtml.length);
            
            const $post = cheerio.load(postHtml);
            let rows = 0;
            $post('#ctl00_MainContent_gvDispatchReport tr').each((i, el) => { rows++ });
            console.log('Table Rows:', rows);
        }
    } catch(e) { console.error('ERROR', e); }
};
login();
