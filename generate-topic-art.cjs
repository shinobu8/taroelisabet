const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist/content.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist/icons.js'),'utf8'),ctx);
const icons=ctx.window.ELISABET_ICONS;
const topics=ctx.window.ELISABET_TOPICS;
const dir=path.join(__dirname,'dist/assets/topics');fs.mkdirSync(dir,{recursive:true});
const pi=Math.PI,ivory='#d5ddbc',sage='#aebf98';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const pt=(r,a,cx=350,cy=250)=>[cx+r*Math.cos(a*pi/180),cy+r*Math.sin(a*pi/180)];
const line=(a,b,o=.5,w=1)=>`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" fill="none" stroke="${ivory}" stroke-opacity="${o}" stroke-width="${w}"/>`;
const circle=(x,y,r,o=.5,fill='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ivory}" stroke-opacity="${o}"/>`;
const star=(x,y,r=8)=>`<path d="M${x} ${y-r}l${r/4} ${r*.75} ${r*.75} ${r/4}-${r*.75} ${r/4}-${r/4} ${r*.75}-${r/4}-${r*.75}-${r*.75}-${r/4} ${r*.75}-${r/4}Z" fill="${ivory}"/>`;
const symbolNames={
 '♈':'aries','♉':'taurus','♊':'gemini','♋':'cancer','♌':'leo','♍':'virgo',
 '♎':'libra','♏':'scorpio','♐':'sagittarius','♑':'capricorn','♒':'aquarius','♓':'pisces','✧':'sparkle'
};
const runeDrawings={
 'ᚠ':'M10 28V4M10 11 24 4M10 20 23 13',
 'ᚢ':'M7 28V5l17 5v18',
 'ᚦ':'M10 28V4M10 10l14 7-14 6',
 'ᚨ':'M10 28V4M10 9l14 7M10 18l14 7',
 'ᚱ':'M9 28V4l15 7-15 7M9 17l16 11',
 'ᚲ':'M24 5 8 16l16 11',
 'ᚷ':'M7 5l18 22M25 5 7 27',
 'ᚹ':'M9 28V4l15 7-15 7'
};
const vectorSymbol=(x,y,shape,size,color)=>`<svg x="${x-size/2}" y="${y-size*.82}" width="${size}" height="${size}" viewBox="0 0 32 32" color="${color}" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
const num=(x,y,n,size=24,color=ivory)=>{
 if(symbolNames[n])return vectorSymbol(x,y,icons.shape(symbolNames[n]),size,color);
 if(runeDrawings[n])return vectorSymbol(x,y,`<path d="${runeDrawings[n]}"/>`,size,color);
 return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" font-family="Georgia,serif">${n}</text>`;
};
function wheel(seed,cx=350,cy=250,r=167){let s=circle(cx,cy,r,.5)+circle(cx,cy,r-13,.3)+circle(cx,cy,r-44,.5);for(let i=0;i<12;i++){s+=line(pt(r,i*30,cx,cy),pt(r-44,i*30,cx,cy),.36);s+=num(...pt(r-29,i*30+15,cx,cy),'♈♉♊♋♌♍♎♏♐♑♒♓'[i],18);}const nodes=[];for(let i=0;i<7;i++){const a=(seed*11+i*51)%360;const p=pt(r-54,a,cx,cy);nodes.push(p);s+=circle(...p,4,.8,ivory);}for(let i=0;i<7;i++)s+=line(nodes[i],nodes[(i+3)%7],.24);s+=circle(cx,cy,45,.3)+star(cx,cy,15);return s;}
function moon(seed){let s='';for(let i=0;i<7;i++){const x=110+i*80,y=250+Math.sin(i*pi/6)*-45;const r=i===3?45:28;const opacity=.5+Math.sin(i*pi/6)*.5;s+=circle(x,y,r,.3,'#a9ba94');s+=`<path d="M${x+6} ${y-r}A${r} ${r} 0 1 0 ${x+6} ${y+r}A${r*.65} ${r} 0 0 1 ${x+6} ${y-r}Z" fill="${ivory}" opacity="${opacity}"/>`;s+=line([x,340],[x,350+(i%2)*10],.3);}s+=`<path d="M70 290Q350 35 630 290M70 320Q350 65 630 320" fill="none" stroke="${ivory}" stroke-opacity=".15"/>`;return s+star(350,99,14)+star(350,391,9);}
function pair(seed){return `<g transform="translate(-80 0)">${wheel(seed,350,250,140)}</g><g opacity=".7" transform="translate(80 0)">${wheel(seed+7,350,250,140)}</g>`+`<path d="M350 285c-60-35-63-65-39-71 20-6 31 5 39 17 9-13 19-23 39-17 24 6 21 36-39 71Z" fill="#c4cfa8" stroke="#183f34" stroke-width="2"/>`;}
function matrix(seed){let s='';const nodes=[];for(let i=0;i<8;i++){nodes.push(pt(166,i*45-90));}for(let i=0;i<8;i++){s+=line(nodes[i],nodes[(i+1)%8],.5);s+=line(nodes[i],nodes[(i+3)%8],.2);}s+=line(nodes[0],nodes[4],.4)+line(nodes[2],nodes[6],.4);nodes.forEach((p,i)=>{s+=circle(...p,22,.8,'#204a3b')+num(p[0],p[1]+7,1+((seed+i*3)%22),22);});s+=circle(350,250,40,.8,'#bccba6')+num(350,263,1+seed%22,39,'#234a37');return s;}
function digits(seed){let s=circle(350,250,170,.3)+circle(350,250,182,.15);for(let i=0;i<9;i++){const a=pt(143,i*40-90);s+=num(a[0],a[1]+10,1+i,28);const b=pt(116,i*40-90),c=pt(116,((i*4+seed)%9)*40-90);s+=line(b,c,.25);}return s+circle(350,250,62,.5,'#1a3c31')+circle(350,250,69,.3)+num(350,278,1+seed%9,82);}
function grid(seed){let s='';for(let i=0;i<4;i++){s+=line([230+i*80,130],[230+i*80,370],.6);s+=line([230,130+i*80],[470,130+i*80],.6);}for(let j=0;j<3;j++)for(let i=0;i<3;i++)s+=num(270+i*80,183+j*80,(j+i*3+1).toString().repeat(1+(seed+i+j)%3),25);return s+circle(350,250,186,.2);}
function cards(seed){let s='';for(let i=0;i<3;i++){const x=185+i*100,y=110+Math.abs(i-1)*30;s+=`<g transform="translate(${x} ${y}) rotate(${(i-1)*15} 64 134)"><rect width="130" height="266" rx="6" fill="${i===1?'#c3cfa9':'#244a3d'}" stroke="${ivory}"/><rect x="10" y="10" width="110" height="246" rx="3" fill="none" stroke="${i===1?'#365942':sage}" stroke-width=".7"/><g opacity="${i===1?.8:.6}" stroke="${i===1?'#365942':ivory}" fill="none"><circle cx="65" cy="126" r="39"/><circle cx="65" cy="126" r="47" stroke-dasharray="1 6"/><path d="M25 216V100a40 40 0 0 1 80 0v116ZM24 217h82M30 226h70"/></g><g fill="${i===1?'#365942':ivory}"><path d="m65 81 8 31 31 14-31 11-8 34-8-34-31-11 31-14Z"/><path d="m65 36 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z"/></g></g>`;}return s;}
function rune(seed){const runes=['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'];let s='';for(let i=0;i<5;i++){let x=150+i*100,y=230+Math.sin(i)*38;s+=`<g transform="translate(${x} ${y}) rotate(${i*11-24})"><ellipse rx="43" ry="60" fill="#68856b" stroke="#a0b58e" stroke-opacity=".6"/><ellipse rx="35" ry="51" fill="none" stroke="#d5ddbc" stroke-opacity=".12"/>${num(0,17,runes[(seed+i)%8],51)}</g>`;}return s+`<ellipse cx="350" cy="270" rx="284" ry="147" fill="none" stroke="${ivory}" stroke-opacity=".2"/>`;}
function iching(seed){let s=circle(350,250,177,.4)+circle(350,250,164,.25);for(let i=0;i<6;i++){const y=150+i*36;if((seed>>i)%2)s+=`<path d="M266 ${y}h168" stroke="${ivory}" stroke-width="12"/>`;else s+=`<path d="M266 ${y}h69m30 0h69" stroke="${ivory}" stroke-width="12"/>`;}return s;}
function bodygraph(seed){let s='';const centers=[[350,94],[350,157],[350,219],[350,283],[350,352],[350,413],[245,335],[455,335],[418,246]];for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++)if((i+j)%3===0||j===i+1)s+=line(centers[i],centers[j],.28,2);centers.forEach((p,i)=>{s+=i<3?`<path d="M${p[0]} ${p[1]-23}l24 42h-48Z" fill="${i%2?'#bac59d':'#395e49'}" stroke="${ivory}" stroke-opacity=".8"/>`:`<rect x="${p[0]-18}" y="${p[1]-18}" width="36" height="36" transform="rotate(${i===3?45:0} ${p[0]} ${p[1]})" fill="${i%2?'#bac59d':'#395e49'}" stroke="${ivory}" stroke-opacity=".8"/>`;});return s+`<path d="M310 100q-50 15-63 90l-55 168m198-258q50 15 63 90l55 168M305 380l-25 83m115-83 25 83" fill="none" stroke="${ivory}" stroke-opacity=".15"/>`;}
function dna(seed){let s=circle(350,250,185,.2);let a=[],b=[];for(let i=0;i<=60;i++){let y=80+i*5.7,x=Math.sin(i/60*pi*4)*71;a.push([350+x,y]);b.push([350-x,y]);if(i%5===0)s+=line([350+x,y],[350-x,y],.45,1.5);}s+=`<polyline points="${a.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${ivory}" stroke-width="3"/><polyline points="${b.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${sage}" stroke-width="3"/>`;return s;}
function coins(seed){let s=wheel(seed,350,250,165);s+=`<g fill="#c4cfa8" stroke="#35543e"><circle cx="350" cy="250" r="62"/><circle cx="350" cy="250" r="52" fill="none"/>`+num(350,266,'✧',53,'#35543e')+'</g>';return s;}
function flowers(seed){let s=cards(seed);for(let i=0;i<3;i++){const x=154+i*193,y=386;for(let j=0;j<5;j++){const p=pt(11,j*72,x,y);s+=circle(...p,8,.5,'#b9c5a0');}s+=circle(x,y,6,.8,'#e0d9b1');}return s;}
const lunar=/moon|lunar|eclipse|solar-return/;
const relationship=/synastry|composite|compatib|relationship|love/;
for(const [index,t] of topics.entries()){
 const seed=[...t.id].reduce((n,c)=>n+c.charCodeAt(0),0);let art;
 if(/human-design/.test(t.id))art=bodygraph(seed);
 else if(/gene/.test(t.id))art=dna(seed);
 else if(/rune/.test(t.id))art=rune(seed);
 else if(/ching|changes/.test(t.id))art=iching(seed);
 else if(/lenormand/.test(t.id))art=flowers(seed);
 else if(/pythag|psychomatrix/.test(t.id))art=grid(seed);
 else if(relationship.test(t.id))art=t.category==='astrology'?pair(seed):t.category==='matrix'?matrix(seed):t.category==='numerology'?digits(seed):cards(seed);
 else if(lunar.test(t.id))art=moon(seed);
 else if(t.category==='matrix')art=matrix(seed);
 else if(t.category==='numerology')art=digits(seed);
 else if(t.category==='tarot')art=cards(seed);
 else if(/financ|money|career/.test(t.id))art=coins(seed);
 else art=wheel(seed);
 let stars='';for(let i=0;i<14;i++){const x=40+((seed*13+i*137)%620),y=35+((seed*7+i*79)%430);if(Math.abs(x-350)>210||Math.abs(y-250)>195)stars+=i%3?circle(x,y,1.4,.6,ivory):star(x,y,4+i%5);}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500" role="img" aria-labelledby="title"><title id="title">${esc(t.title)} — символическая иллюстрация</title><defs><radialGradient id="bg" cx="${42+seed%20}%" cy="43%"><stop stop-color="#365e4e"/><stop offset="1" stop-color="#102c2b"/></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer></filter></defs><rect width="700" height="500" fill="url(#bg)"/><g opacity=".65">${stars}</g>${art}<rect width="700" height="500" filter="url(#grain)"/></svg>`;
 fs.writeFileSync(path.join(dir,t.id+'.svg'),svg);
}
console.log(`Generated ${topics.length} individual topic SVG illustrations.`);
