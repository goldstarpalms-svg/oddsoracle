#!/usr/bin/env python3
"""
fetch_oddschecker.py — keyless LIVE odds from OddsChecker (UK, 25+ books incl. bet365/Betfair).

How it works:
  * OddsChecker match pages (SSR) embed a full odds JSON blob in the HTML
    (bestOdds: bets x bookmakers, decimal odds, feed timestamps).
  * Slug pattern: /football/<country>/<league>/<home>-v-<away>/winner
  * League pages list every fixture slug -> we resolve board matches by team name.

Output: backend/app/daily/<date>_oddschecker.json
  {fetched_at, source, games: {"Home|Away": {oc_url, win_best:[h,x,a], win_books:{code:[h,x,a]},
   htft_best:{H/H:...}, books:{code:name}, updated_ts, feed_ts}}}

Run:  python3 backend/app/fetch_oddschecker.py [YYYY-MM-DD]
Idempotent. ~60-90s for a 40-game day (11 league pages + up to 40 match pages).
"""
import json, os, re, sys, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, 'daily')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}

LEAGUE_PATHS = {
    'E0': 'english/premier-league',
    'E1': 'english/championship',
    'I1': 'italy/serie-a',
    'I2': 'italy/serie-b',
    'SP1': 'spain/la-liga-primera',
    # SP2 (La Liga 2) not covered by OddsChecker UK
    'F1': 'france/ligue-1',
    'D1': 'germany/bundesliga',
    'NL1': 'netherlands/eredivisie',
    'SC0': 'scottish/premiership',
    'TR1': 'turkey/super-lig',
}

BOOK_NAMES = {
    'B3': 'bet365', 'BF': 'Betfair', 'WH': 'William Hill', 'UN': 'Unibet', 'FR': 'Betfred',
    'SX': 'Spreadex', 'LD': 'Ladbrokes', 'VC': 'BetVictor', 'KN': 'BetMGM', 'BY': 'Boyle Sports',
    'OE': '10bet', 'S6': 'Star Sports', 'PUP': 'PricedUp', 'SI': 'Sporting Index', 'G5': 'BetGoodwin',
    'QN': 'QuinnBet', 'WA': 'Betway', 'CE': 'Coral', 'BAH': 'BetAhoy', 'BTT': 'BetTom',
    'IVB': 'IvyBet', 'SK': 'Skybet', 'PP': 'Paddy Power', 'AKB': 'AK Bets', 'MA': 'Matchbook', 'EP': '888 Poker',
}

def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            if i == tries - 1:
                return None
            time.sleep(2.5 * (i + 1))
    return None

# forebet short names -> oddschecker names
ALIASES = {
    'man-united': ['man-utd', 'manchester-united'],
    'wolves': ['wolverhampton'], 'west-brom': ['west-brom'],
    'psv-eindhoven': ['psv'], 'paris-sg': ['psg'], 'psg': ['psg'],
    'sudtirol': ['alto-adige'], 'nijmegen': ['nec'],
    'ath-madrid': ['atletico-madrid'], 'la-coruna': ['deportivo-a-coruna', 'la-coruna'],
    'amedspor': ['amed-sk'], 'sabadell': ['espanyol-b'],
}

def league_slugs(path):
    """All fixture winner-links on a league page."""
    html = get(f'https://www.oddschecker.com/football/{path}')
    if not html:
        return {}
    links = re.findall(r'href="?((?:/)?football/%s/[a-z0-9-]+/winner)"' % re.escape(path), html)
    out = {}
    for l in set(links):
        parts = l.lstrip('/').split('/')
        slug = parts[-2]  # .../<home>-v-<away>/winner
        if '-v-' in slug:
            h, a = slug.split('-v-', 1)
            out[slug] = (h, a)
    return out

def parse_match(html):
    """Extract embedded bestOdds JSON -> win market + HT/FT best odds."""
    blobs = re.findall(r'<!--(\{.*?\})-->', html, re.S)
    blob = max((b for b in blobs if '"bestOdds"' in b), key=len, default=None)
    if not blob:
        return None
    d = json.loads(blob)
    bo = d.get('bestOdds') or {}
    bets = bo.get('bets', {}).get('entities', {})
    mkts = {m['ocMarketId']: m for m in bo.get('markets', {}).get('entities', {}).values()}
    odds = bo.get('odds', {})
    books = {k: v.get('bookmakerName') for k, v in bo.get('bookmakers', {}).get('entities', {}).items()}
    win_bets, htft_bets = [], []
    for b in bets.values():
        m = mkts.get(b['marketId'])
        if not m:
            continue
        if m['marketTypeName'] == 'Win Market':
            win_bets.append(b)
        elif m['marketTypeName'] == 'Half Time/Full Time':
            htft_bets.append(b)
    out = {'books': {k: v for k, v in books.items() if v}}
    # win market: 3 bets in order home / draw / away
    win = {}
    non_draw = []
    for b in win_bets:
        per = odds.get(str(b['ocBetId']), {})
        vals = {bk: o.get('oddsDecimal') for bk, o in per.items()
                if o.get('oddsDecimal') and o.get('status') == 'ACTIVE'}
        if not vals:
            continue
        slot = 'x' if b['betName'].strip().lower() == 'draw' else None
        if slot:
            win['x'] = {'best': max(vals.values()), 'books': vals}
        else:
            non_draw.append({'best': max(vals.values()), 'books': vals})
    if non_draw:
        win['h'] = non_draw[0]
    if len(non_draw) > 1:
        win['a'] = non_draw[1]
    htft = {}
    for b in htft_bets:
        per = odds.get(str(b['ocBetId']), {})
        vals = {bk: o.get('oddsDecimal') for bk, o in per.items()
                if o.get('oddsDecimal') and o.get('status') == 'ACTIVE'}
        if vals:
            htft[b['betName'].replace('/', '-')] = {'best': max(vals.values()), 'books': vals}
    feed_ts = None
    for per in list(odds.values())[:50]:
        for o in per.values():
            ts = o.get('betFeedTimestamp')
            if ts and (feed_ts is None or ts > feed_ts):
                feed_ts = ts
    out['win'] = win
    out['htft'] = htft
    out['updated_ts'] = d.get('lastUpdated')
    out['feed_ts'] = feed_ts
    return out

def main():
    date = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y-%m-%d')
    src = os.path.join(DAILY, f'{date}.json')
    if not os.path.exists(src):
        print(f'daily file missing: {src}'); sys.exit(1)
    board = json.load(open(src))
    games = board.get('games', [])
    by_league = {}
    for g in games:
        lc = g.get('league_code')
        if lc in LEAGUE_PATHS:
            by_league.setdefault(lc, []).append(g)

    # 1) league slugs
    slug_map = {}  # lc -> {slug: (home,away)}
    for lc in by_league:
        slug_map[lc] = league_slugs(LEAGUE_PATHS[lc])
        time.sleep(0.4)

    # 2) match each game to a slug
    import difflib
    def close(a, b):
        if not a or not b:
            return False
        return a == b or (a in b) or (b in a) or difflib.SequenceMatcher(None, a, b).ratio() >= 0.70
    def cand(n):
        return ALIASES.get(n, [n])
    tasks = []  # (game, url)
    for lc, gl in by_league.items():
        sm = slug_map.get(lc, {})
        for g in gl:
            hn, an = norm(g['home']), norm(g['away'])
            hit = None
            for hc in cand(hn):
                for ac in cand(an):
                    for slug, (h, a) in sm.items():
                        if close(hc, h) and close(ac, a):
                            hit = slug
                            break
                    if hit:
                        break
                if hit:
                    break
            if hit:
                tasks.append((g, f'https://www.oddschecker.com/football/{LEAGUE_PATHS[lc]}/{hit}/winner'))
            else:
                print(f'  no slug: {g["home"]} v {g["away"]} ({lc})')

    # 3) fetch match pages (4 parallel)
    results = {}
    def work(t):
        g, url = t
        html = get(url)
        return g, url, (parse_match(html) if html else None)
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(work, t) for t in tasks]
        for f in as_completed(futs):
            g, url, parsed = f.result()
            key = f"{g['home']}|{g['away']}"
            if parsed and parsed.get('win'):
                results[key] = {'oc_url': url, **parsed}
                print(f"  OK {key}: 1X2 best={[round(w['best'],2) for w in parsed['win'].values()]} books={len(parsed.get('books', {}))}")
            else:
                print(f'  MISS {key}: no win-market odds')
            time.sleep(0.3)

    out = {
        'date': date,
        'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'source': 'oddschecker (UK, keyless, 25+ books)',
        'games': results,
    }
    with open(os.path.join(DAILY, f'{date}_oddschecker.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'{date}_oddschecker.json: {len(results)}/{len(tasks)} games with live odds')

if __name__ == '__main__':
    main()
