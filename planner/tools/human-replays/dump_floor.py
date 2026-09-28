import json,sys
h=sys.argv[1]; fl=[int(x) for x in sys.argv[2].split(',')]
skip=set(sys.argv[3].split(',')) if len(sys.argv)>3 else {'hit','power','block','turn','move','hp','gold'}
L=[json.loads(l) for l in open(f'replays/{h}.ndjson',encoding='utf8') if l.strip()]
for x in L:
    if x.get('floor') in fl and x['t'] not in skip:
        s={k:v for k,v in x.items() if k not in ('s','ms','act','floor')}
        if x['t']=='decision': s['options']=[(o.get('option_id') or '').split('.')[-1]+('/'+str(o.get('c')) if o.get('c') else '') for o in x.get('options',[])][:20]
        if x['t'] in ('map','deck','shop'): s={'t':x['t'],'n':len(x.get('cards',[]))}
        if x['t']=='draw': s={'t':'draw','c':x.get('c'),'dc':x.get('deck_c'),'id':x.get('id')}
        print(x.get('floor'),' ', json.dumps(s,ensure_ascii=False)[:250])
