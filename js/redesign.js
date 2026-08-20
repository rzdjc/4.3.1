/* Mobile-first light redesign (ink/stone/paper) — replaces workout/program/progress/history/settings render
   functions and adds a full-screen one-exercise-at-a-time live session. Reuses S/save/view/toast/activeDays/
   lastForExercise/exerciseTagFor/actualWeeklySets from app.js (shared global scope, classic scripts). */
(function(){
S.units=S.units||'kg';
S.restTimerAuto=S.restTimerAuto??true;
S.restTimerSeconds=S.restTimerSeconds||90;
S.weeklyEmail=S.weeklyEmail??false;
S.showWarmups=S.showWarmups??true;

function rd_rangeFor(name){const d=activeDays().flatMap(x=>x[2]).find(e=>e[0]===name);return d?parseRange(d[1]):{sets:1,min:1,max:99}}
function rd_targetLabel(name){const r=rd_rangeFor(name),def=activeDays().flatMap(x=>x[2]).find(e=>e[0]===name),rir=def?.[2]||'1-2';const reps=r.min===r.max?r.min:`${r.min}–${r.max}`;return `${r.sets} × ${reps} reps · RIR ${esc(rir)}`}
function rd_lastLabel(name){const l=lastForExercise(name);if(!l||!l.sets?.length)return '';const w=l.sets[l.sets.length-1];return `Last time: ${esc(w.w||'—')} kg × ${esc(w.r||'—')} × ${l.sets.length}`}
function rd_calc1RM(w,r){w=parseFloat(w)||0;r=parseFloat(r)||0;return w*(1+r/30)}
function rd_bestWeight(name){let best=0;S.workouts.forEach(w=>(w.entries||[]).forEach(e=>{if(e.exercise===name)(e.sets||[]).forEach(x=>best=Math.max(best,parseFloat(x.w)||0))}));return best}
function rd_kg(w){return S.units==='lb'?Math.round(w*2.20462):Math.round(w)}
function rd_unitLabel(){return S.units==='lb'?'lb':'kg'}
function rd_programList(){return [{id:'builtin',name:BUILTIN_NAME,days:BUILTIN_DAYS},...(S.programs||[])]}
function rd_exerciseHistory(name){
 const rows=[];
 S.workouts.forEach(w=>{
  const e=(w.entries||[]).find(x=>x.exercise===name);
  if(!e||!e.sets?.length)return;
  const best=e.sets.reduce((b,s)=>(parseFloat(s.w)||0)>(parseFloat(b.w)||0)?s:b,e.sets[0]);
  rows.push({date:w.date,summary:e.summary||e.sets.map(s=>`${s.w}×${s.r}`).join(', '),pr:!!e.pr,bestWeight:parseFloat(best.w)||0});
 });
 return rows.reverse();
}
function rd_exerciseInsight(name){
 const rows=rd_exerciseHistory(name);
 if(rows.length<3)return null;
 const latest=rows[0].bestWeight;
 const cutoff=rd_weekCutoff(43);
 let baseline=rows[rows.length-1];
 for(let i=rows.length-1;i>=0;i--){if(rows[i].date>=cutoff){baseline=rows[i];break}}
 const diff=+(latest-baseline.bestWeight).toFixed(1);
 if(Math.abs(diff)<0.5){
  const lastThree=rows.slice(0,3).map(r=>r.bestWeight);
  if(lastThree.every(w=>w===lastThree[0]&&w>0))return {text:`Your best set has held at ${lastThree[0]}kg for 3 sessions.`};
  return null;
 }
 return {text:`${esc(name)} is ${diff>0?'up':'down'} ${Math.abs(diff)}kg over the last 6 weeks.`};
}

function rd_weekCutoff(days){const c=new Date();c.setDate(c.getDate()-(days-1));return c.toISOString().slice(0,10)}
function rd_weekWorkouts(){const cutoff=rd_weekCutoff(7);return S.workouts.filter(w=>w.date>=cutoff)}
function rd_streak(){const dates=[...new Set(S.workouts.map(w=>w.date))].sort().reverse();if(!dates.length)return 0;const today0=new Date(today());const gap0=Math.round((today0-new Date(dates[0]))/86400000);if(gap0>2)return 0;let streak=1,cur=new Date(dates[0]);for(let i=1;i<dates.length;i++){const d=new Date(dates[i]);const diff=Math.round((cur-d)/86400000);if(diff<=2){streak++;cur=d}else break}return streak}
function rd_weekTarget(){return activeDays().filter(d=>d[2].length).length}
function rd_weekDone(){const dates=new Set(rd_weekWorkouts().map(w=>w.date));return Math.min(dates.size,rd_weekTarget())}

function rd_setsCount(w){return (w.entries||[]).reduce((a,e)=>a+(e.sets?.length||0),0)}
function rd_weekTotalSets(){return Object.values(actualWeeklySets()).reduce((a,v)=>a+v,0)}
function rd_prevWeekTotalSets(){const start=rd_weekCutoff(14),end=rd_weekCutoff(7);let total=0;S.workouts.forEach(w=>{if(w.date>=start&&w.date<end)total+=rd_setsCount(w)});return total}
function rd_prevWeekMuscleSets(){const start=rd_weekCutoff(14),end=rd_weekCutoff(7);const totals={};S.workouts.forEach(w=>{if(w.date<start||w.date>=end)return;(w.entries||[]).forEach(e=>{const tag=exerciseTagFor(e.exercise);totals[tag]=(totals[tag]||0)+(e.sets?.length||0)})});return totals}
function rd_weekGoalSetsSum(){return Object.values(S.volumeGoals||{}).reduce((a,v)=>a+v,0)}
function rd_setsSeries(){const days=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}const byDate={};S.workouts.forEach(w=>{byDate[w.date]=(byDate[w.date]||0)+rd_setsCount(w)});const vals=days.map(d=>byDate[d]||0);const max=Math.max(...vals,1);return days.map((d,i)=>({h:Math.round((vals[i]/max)*104)||2,isToday:d===today(),label:new Date(d+'T00:00').getDay()===0?'S':'MTWTFS'[new Date(d+'T00:00').getDay()-1]||'S',v:vals[i]}))}

function rd_toast(msg){toast(msg)}
function rd_haptic(pattern){try{navigator.vibrate?.(pattern)}catch(_){}}

function rd_openDialog(html){document.getElementById('modalbody').innerHTML=html;document.getElementById('modal').classList.remove('hidden')}
function rd_closeDialog(){document.getElementById('modal').classList.add('hidden')}

/* ---------- Today ---------- */
function rd_today(){
 const day=activeDays()[S.day];
 let h='<div class="rd-view">';
 h+=`<div class="rd-header"><div><div class="rd-eyebrow">${day[2].length?`Day ${S.day+1}`:'Recovery day'}</div><h1 class="rd-h1">Today</h1></div></div>`;
 if(day[2].length){
  h+=`<div class="rd-hero rd-fade" style="background-image:url(images/bench-rest.jpg)"><div class="rd-hero-content"><div><span class="rd-badge rd-badge-ink">Day ${S.day+1}</span><div class="rd-hero-h">${esc(day[0].replace(/^DAY \d+ — /,''))}</div><div class="rd-hero-meta">${day[2].length} exercise${day[2].length===1?'':'s'}${day[1]?' · '+esc(day[1]):''}</div></div><button class="rd-btn onImage sm" id="rdStartToday">Start</button></div></div>`;
 } else {
  h+=`<div class="rd-rest-card rd-fade"><div class="rd-eyebrow">Recovery</div><h2 class="rd-h2">Rest today</h2><p>Keep activity easy and let the next session hit fresh. No workout scheduled.</p></div>`;
 }
 h+='<div style="padding:0 22px;display:flex;flex-direction:column;gap:20px">';
 const weekDone=rd_weekDone(),weekTotal=rd_weekTarget(),weekSets=rd_weekTotalSets(),goalSets=rd_weekGoalSetsSum();
 h+=`<div class="rd-stat-grid rd-fade" style="animation-delay:.05s">
  <div class="rd-stat-tile"><span class="lbl">Streak</span><span class="val">${rd_streak()}<small>d</small></span></div>
  <div class="rd-stat-tile"><span class="lbl">This week</span><span class="val">${weekDone}<small>/ ${weekTotal}</small></span></div>
  <div class="rd-stat-tile"><span class="lbl">Sets</span><span class="val">${weekSets}</span></div>
 </div>`;
 if(goalSets>0){
  const goalPct=Math.min(100,Math.round(weekSets/goalSets*100));
  h+=`<div class="rd-fade" style="animation-delay:.1s"><div class="rd-progress-row"><span class="rd-progress-label">Weekly sets goal</span><span class="rd-progress-caption">${weekSets} / ${goalSets} sets</span></div><div class="rd-progress-track"><div class="rd-progress-fill" style="width:${goalPct}%"></div></div></div>`;
 } else {
  h+=`<div class="rd-fade" style="animation-delay:.1s"><div class="rd-progress-row"><span class="rd-progress-label">Weekly sets</span><span class="rd-progress-caption">${weekSets} sets</span></div><div style="font-size:11px;color:var(--stone-500)">Tap a muscle group on Progress to set a weekly goal.</div></div>`;
 }
 if(day[2].length){
  h+=`<div class="rd-fade" style="animation-delay:.15s"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px"><span class="rd-eyebrow" style="margin:0">Plan</span><span style="font-size:11px;color:var(--stone-500)">${esc(activeProgramName())}</span></div><div class="rd-card pad-0">`;
  day[2].forEach((ex,i)=>{
   const last=lastForExercise(ex[0]);
   h+=`<button class="rd-row rd-row-anim rd-fade" style="animation-delay:${Math.min(i*40,200)}ms" data-info="${i}"><svg class="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M2 9v6M18 7v10M22 9v6M6 12h12"/></svg><div class="body"><div class="name">${esc(ex[0])}</div><div class="meta">${rd_targetLabel(ex[0])}${last?.summary?` · last ${esc(last.summary)}`:''}</div></div><svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></button>`;
  });
  h+='</div></div>';
 }
 h+='<div style="height:8px"></div></div></div>';
 document.getElementById('workout').innerHTML=h;
 document.getElementById('rdStartToday')?.addEventListener('click',()=>rd_startSession(0));
 document.querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>rd_openExerciseInfo(+b.dataset.info));
}

/* ---------- Program ---------- */
function rd_program(){
 const active=S.day,days=activeDays(),day=days[active]||days[0];
 let h='<div class="rd-view" style="padding-top:16px">';
 h+='<div style="padding:0 22px 8px"><div class="rd-eyebrow">Your split</div><h1 class="rd-h1" style="margin-bottom:16px">Program</h1>';
 h+='<div class="rd-chip-row" style="margin-bottom:16px">';
 rd_programList().forEach(p=>{h+=`<button class="rd-tag ${p.id===(S.activeProgram||'builtin')?'selected':''}" data-select-prog="${esc(p.id)}">${esc(p.name)}</button>`});
 h+='<button class="rd-tag" id="rdNewSplit">+ New split</button></div>';
 h+='<div class="rd-chip-row" style="margin-bottom:18px">';
 days.forEach((d,i)=>{h+=`<button class="rd-day-chip ${i===active?'active':''}" data-select-day="${i}" aria-label="Day ${i+1}${!d[2].length?', rest':''}"><b>${String(i+1).padStart(2,'0')}</b><span>${!d[2].length?'Rest':esc((d[0].split('—')[1]||d[0]).trim())}</span></button>`});
 h+='</div>';
 if(!day[2].length){
  h+=`<div class="rd-card"><div class="rd-eyebrow" style="margin-bottom:0">Day ${active+1}</div><h2 class="rd-h2">Recovery</h2><div style="font-size:13px;color:var(--stone-500);margin-top:10px;line-height:1.5">Keep activity easy — walking, mobility, sleep. You don't need to force a session.</div></div>`;
 } else {
  h+=`<div class="rd-card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px"><div><div class="rd-eyebrow" style="margin-bottom:0">Day ${active+1}</div><h2 class="rd-h2">${esc(day[0].replace(/^DAY \d+ — /,''))}</h2><div style="font-size:12.5px;color:var(--stone-500);margin-top:4px">${esc(day[1])}</div></div><button class="rd-btn primary sm" id="rdStartProgram">Start →</button></div></div>`;
  h+='<div class="rd-card pad-0" style="margin-top:14px">';
  day[2].forEach((ex,i)=>{h+=`<button class="rd-row" data-info2="${i}"><span class="num">${String(i+1).padStart(2,'0')}</span><div class="body"><div class="name">${esc(ex[0])}</div><div class="meta">${rd_targetLabel(ex[0])} · ${esc(ex[3])}</div></div><svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></button>`});
  h+='</div>';
 }
 h+='<div style="height:20px"></div></div></div>';
 document.getElementById('program').innerHTML=h;
 document.querySelectorAll('[data-select-prog]').forEach(b=>b.onclick=()=>rd_selectProgram(b.dataset.selectProg));
 document.getElementById('rdNewSplit')?.addEventListener('click',rd_openBuilder);
 document.querySelectorAll('[data-select-day]').forEach(b=>b.onclick=()=>{S.day=+b.dataset.selectDay;save();rd_program()});
 document.getElementById('rdStartProgram')?.addEventListener('click',()=>rd_startSession(0));
 document.querySelectorAll('[data-info2]').forEach(b=>b.onclick=()=>rd_openExerciseInfo(+b.dataset.info2));
}
function rd_selectProgram(id){
 if(id===(S.activeProgram||'builtin'))return;
 if(S.active&&Object.keys(S.active.entries||{}).length&&!confirm('Switch programs? Your unfinished workout will be discarded.'))return;
 S.activeProgram=id;S.day=0;S.active=null;save();rd_toast('Program switched');rd_program()
}

/* ---------- Progress ---------- */
function rd_progress(){
 window.__rdProgressTab=window.__rdProgressTab||'Measures';
 const weekSets=rd_weekTotalSets(),prevSets=rd_prevWeekTotalSets(),goalSets=rd_weekGoalSetsSum();
 const delta=prevSets?Math.round((weekSets-prevSets)/prevSets*100):null;
 const goalPct=goalSets>0?weekSets/goalSets:null;
 const tone=goalPct==null?'warning':goalPct>=.7?'success':'warning';
 const label=goalPct==null?'No goals set':goalPct>=1?'Goal met':goalPct>=.7?'On track':'Behind';
 let h='<div class="rd-view" style="padding-top:16px">';
 h+='<div style="padding:0 22px 8px"><div class="rd-eyebrow">This week</div><h1 class="rd-h1" style="margin-bottom:18px">Progress</h1>';
 h+=`<div class="rd-card" style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px"><div class="rd-stat-tile"><span class="lbl">Sets this week</span><span class="val">${weekSets}</span>${delta!=null?`<span class="delta ${delta>=0?'up':'down'}">${delta>=0?'+':''}${delta}% vs last week</span>`:''}</div><span class="rd-badge rd-badge-${tone}">${label}</span></div>`;
 h+='<div class="rd-chart">';
 rd_setsSeries().forEach(d=>{h+=`<div class="rd-chart-col"><div class="rd-chart-bar" style="height:${d.h}px;background:${d.isToday?'var(--ink-800)':'var(--stone-300)'}"></div><span class="rd-chart-label">${d.label}</span></div>`});
 h+='</div></div>';
 h+='<div class="rd-eyebrow" style="margin:22px 0 4px">Sets by body part</div><div style="font-size:11px;color:var(--stone-500);margin-bottom:10px">This week vs last week. Tap a row to set a goal.</div>';
 h+='<div class="rd-card pad-0">'+rd_muscleGoalRows()+'</div>';
 h+=`<div style="margin-top:26px"><div class="rd-tabs"><button class="rd-tab ${window.__rdProgressTab==='Exercises'?'active':''}" id="rdTabEx">Exercises</button><button class="rd-tab ${window.__rdProgressTab==='Measures'?'active':''}" id="rdTabMe">Measures</button></div><div style="padding-top:14px">`;
 if(window.__rdProgressTab==='Exercises'){
  const names=[...new Set(activeDays().flatMap(d=>d[2]).map(e=>e[0]))];
  const lastW=S.workouts[S.workouts.length-1];
  if(!names.length)h+='<div style="padding:24px 2px;color:var(--stone-500);font-size:13px">No exercises in your active program.</div>';
  else h+='<div style="font-size:11px;color:var(--stone-500);margin-bottom:10px">Tap an exercise to see its history.</div>';
  const byTag={};
  names.forEach(n=>{const tag=exerciseTagFor(n);(byTag[tag]=byTag[tag]||[]).push(n)});
  const tags=Object.keys(byTag).sort((a,b)=>byTag[b].length-byTag[a].length||a.localeCompare(b));
  tags.forEach((tag,ti)=>{
   h+=`<details class="rd-muscle-group" ${ti===0?'open':''}><summary><span>${esc(tag)}</span><span class="count">${byTag[tag].length} exercise${byTag[tag].length===1?'':'s'}</span></summary>`;
   byTag[tag].forEach(n=>{
    const best=rd_bestWeight(n);
    const isPr=!!lastW&&(lastW.entries||[]).some(e=>e.exercise===n&&e.pr);
    h+=`<button class="rd-ex-row" data-ex-hist="${esc(n)}"><span class="rd-ex-name">${esc(n)}</span>${isPr?'<span class="rd-badge rd-badge-success">New PR</span>':''}<span class="rd-ex-best">${best?rd_kg(best)+' '+rd_unitLabel():'—'}</span></button>`;
   });
   h+='</details>';
  });
 } else {
  const m=S.metrics,last=m[m.length-1]||{},prev=m[m.length-2]||{};
  const wd=last.weight&&prev.weight?(+last.weight-+prev.weight).toFixed(1):null;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px"><div class="rd-stat-tile"><span class="lbl">Bodyweight</span><span class="val">${last.weight??'—'}<small>kg</small></span>${wd?`<span class="delta ${wd>0?'down':'up'}">${wd>0?'+':''}${wd} kg</span>`:''}</div><div class="rd-stat-tile"><span class="lbl">Waist</span><span class="val">${last.waist??'—'}<small>cm</small></span></div></div>`;
  h+='<button class="rd-btn outline sm" id="rdOpenCheckin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add check-in</button>';
  h+='<div style="margin-top:16px">';
  m.slice().reverse().slice(0,3).forEach(x=>{h+=`<div style="display:flex;justify-content:space-between;padding:10px 2px;border-bottom:1px solid var(--border-hairline);font-size:13px"><span style="color:var(--stone-500)">${esc(x.date)}</span><span style="font-family:'Barlow Semi Condensed',sans-serif;font-weight:600">${esc(x.weight)} kg</span></div>`});
  if(!m.length)h+='<div style="padding:16px 2px;color:var(--stone-500);font-size:13px">No check-ins yet.</div>';
  h+='</div>';
 }
 h+='</div></div>';
 h+='<div style="height:20px"></div></div></div>';
 document.getElementById('progress').innerHTML=h;
 document.getElementById('rdTabEx').onclick=()=>{window.__rdProgressTab='Exercises';rd_progress()};
 document.getElementById('rdTabMe').onclick=()=>{window.__rdProgressTab='Measures';rd_progress()};
 document.getElementById('rdOpenCheckin')?.addEventListener('click',rd_openCheckin);
 document.querySelectorAll('[data-goal-tag2]').forEach(b=>b.onclick=()=>rd_openGoalEditor(b.dataset.goalTag2));
 document.querySelectorAll('[data-ex-hist]').forEach(b=>b.onclick=()=>rd_openExerciseHistory(b.dataset.exHist));
}
function rd_muscleGoalRows(){
 const actual=actualWeeklySets(),prevActual=rd_prevWeekMuscleSets(),goals=S.volumeGoals||{};
 const programTags=Object.keys(exerciseTotals());
 const tags=new Set([...programTags,...Object.keys(actual),...Object.keys(goals),...Object.keys(prevActual)]);
 if(!tags.size)return '<div style="padding:20px 18px;color:var(--stone-500);font-size:13px">Select a program with exercises to set weekly goals by body part.</div>';
 const sorted=[...tags].sort((a,b)=>(actual[b]||0)-(actual[a]||0)||a.localeCompare(b));
 const maxSets=Math.max(...sorted.map(t=>actual[t]||0),1);
 return sorted.map(t=>{
  const sets=actual[t]||0,goal=goals[t],prev=prevActual[t]||0,met=!!goal&&sets>=goal;
  const pct=goal?Math.min(100,Math.round(sets/goal*100)):Math.round(sets/maxSets*100);
  const delta=sets-prev;
  return `<button class="rd-muscle-row" data-goal-tag2="${esc(t)}"><div class="rd-muscle-row-top"><span class="rd-muscle-name">${esc(t)}</span><span class="rd-muscle-count">${sets}${goal?`<b> / ${goal}</b>`:''} sets${delta!==0?`<em class="${delta>0?'up':'down'}">${delta>0?'+':''}${delta} vs last wk</em>`:''}${met?' <span class="rd-badge rd-badge-success" style="margin-left:4px">✓</span>':''}${goal?'':'<span class="rd-goal-cta">+ Set goal</span>'}</span></div><div class="rd-progress-track" style="height:5px"><div class="rd-progress-fill${met?' met':''}" style="width:${pct}%"></div></div></button>`;
 }).join('')
}
function rd_openExerciseHistory(name){
 const rows=rd_exerciseHistory(name);
 const insight=rd_exerciseInsight(name);
 let body=insight?`<div class="rd-insight-box">${insight.text}</div>`:'';
 if(!rows.length){
  body+='<div style="padding:16px 2px;color:var(--stone-500);font-size:13px">No previous sessions. Complete this exercise to start building your history.</div>';
 } else {
  rows.forEach(r=>{body+=`<div class="rd-complete-exrow"><span class="name">${esc(r.date)}</span><span class="val">${esc(r.summary)}${r.pr?' · PR':''}</span></div>`});
 }
 rd_openDialog(`<div class="rd-dialog-title">${esc(name)}</div>${body}<div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdExHistClose">Close</button></div>`);
 document.getElementById('rdExHistClose').onclick=rd_closeDialog;
}
function rd_openGoalEditor(tag){
 const current=S.volumeGoals?.[tag]||'';
 rd_openDialog(`<div class="rd-dialog-title">${esc(tag)}</div><div class="rd-field" style="margin-bottom:16px"><label>Weekly set goal</label><input class="rd-input" id="rdGoalInput" type="number" inputmode="numeric" value="${current}" placeholder="e.g. 14"></div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdGoalCancel">Cancel</button><button class="rd-btn primary sm" id="rdGoalSave">Save</button></div>`);
 document.getElementById('rdGoalCancel').onclick=rd_closeDialog;
 document.getElementById('rdGoalSave').onclick=()=>{const v=parseInt(document.getElementById('rdGoalInput').value);S.volumeGoals=S.volumeGoals||{};if(v>0)S.volumeGoals[tag]=v;else delete S.volumeGoals[tag];save();rd_closeDialog();rd_progress()}
}

/* ---------- History ---------- */
function rd_history(){
 let h='<div class="rd-view" style="padding-top:16px">';
 h+=`<div style="padding:0 22px 8px"><div class="rd-eyebrow">${S.workouts.length} session${S.workouts.length===1?'':'s'}</div><h1 class="rd-h1" style="margin-bottom:18px">History</h1>`;
 if(!S.workouts.length){
  h+='<div class="rd-card" style="text-align:center;padding:34px 22px"><div style="font-size:13px;color:var(--stone-500);line-height:1.6">No sessions yet. Finish a workout and it will show up here.</div></div>';
 } else {
  h+='<div style="display:flex;flex-direction:column;gap:10px">';
  S.workouts.slice().reverse().forEach((x,idx)=>{
   const sets=(x.entries||[]).reduce((a,e)=>a+(e.sets?.length||0),0),reps=(x.entries||[]).reduce((a,e)=>a+(e.sets||[]).reduce((b,s)=>b+(+s.r||0),0),0);
   const prs=x.prs?.length||0;
   h+=`<button class="rd-card interactive rd-fade" style="animation-delay:${Math.min(idx*50,200)}ms" data-hist="${S.workouts.length-1-idx}"><div class="rd-history-card"><div class="rd-history-date"><span>${esc(x.date.slice(5))}</span><b>${String(S.workouts.length-idx).padStart(2,'0')}</b></div><div class="body"><div class="name">${esc(x.day.replace(/^DAY \d+ — /,''))}</div><div class="meta">${sets} sets · ${reps} reps</div></div>${prs?`<span class="rd-badge rd-badge-success">${prs} PR${prs>1?'s':''}</span>`:''}<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></div></button>`;
  });
  h+='</div>';
 }
 h+='<div style="height:20px"></div></div></div>';
 document.getElementById('history').innerHTML=h;
 document.querySelectorAll('[data-hist]').forEach(b=>b.onclick=()=>rd_openHistoryDetail(+b.dataset.hist));
}
function rd_openHistoryDetail(i){
 const w=S.workouts[i];if(!w)return;
 const setsCount=(w.entries||[]).reduce((a,e)=>a+(e.sets?.length||0),0);
 let body=`<div style="font-size:11px;color:var(--stone-500);margin-bottom:10px">${esc(w.date)} · ${setsCount} set${setsCount===1?'':'s'}</div>`;
 (w.entries||[]).forEach(e=>{body+=`<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border-hairline);font-size:14px"><span style="font-weight:600;font-family:'Barlow Semi Condensed',sans-serif">${esc(e.exercise)}</span><span style="color:var(--stone-500)">${esc(e.summary||'')}</span></div>`});
 rd_openDialog(`<div class="rd-dialog-title">${esc(w.day.replace(/^DAY \d+ — /,''))}</div>${body}<div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdHistClose">Close</button></div>`);
 document.getElementById('rdHistClose').onclick=rd_closeDialog;
}

/* ---------- You (settings) ---------- */
function rd_you(){
 const prs=S.workouts.reduce((a,w)=>a+(w.prs?.length||0),0);
 const totalSets=S.workouts.reduce((a,w)=>a+rd_setsCount(w),0);
 let h='<div class="rd-view">';
 h+=`<div class="rd-you-hero" style="background-image:url(images/wraps-portrait.jpg)"><div class="rd-you-hero-content"><div class="rd-eyebrow" style="color:rgba(255,255,255,.8);margin-bottom:8px">Your training</div><h1 class="rd-h1" style="color:var(--white)">You</h1></div></div>`;
 h+='<div style="padding:22px;display:flex;flex-direction:column;gap:24px">';
 h+=`<div class="rd-stat-grid"><div class="rd-stat-tile"><span class="lbl">Sessions</span><span class="val">${S.workouts.length}</span></div><div class="rd-stat-tile"><span class="lbl">Total sets</span><span class="val">${totalSets}</span></div><div class="rd-stat-tile"><span class="lbl">PRs</span><span class="val">${prs}</span></div></div>`;
 h+='<div><div class="rd-eyebrow" style="margin-bottom:14px">Training</div><div style="display:flex;flex-direction:column;gap:18px">';
 h+=`<div class="rd-field"><label>Active split</label><select class="rd-select" id="rdSelProgram">${rd_programList().map(p=>`<option value="${esc(p.id)}" ${p.id===(S.activeProgram||'builtin')?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>`;
 h+=`<div class="rd-switch-row"><span style="font-size:10.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--stone-500)">Units</span><div class="rd-segmented"><button class="${S.units==='kg'?'active':''}" data-unit="kg">kg</button><button class="${S.units==='lb'?'active':''}" data-unit="lb">lb</button></div></div>`;
 h+='</div></div>';
 h+='<div><div class="rd-eyebrow" style="margin-bottom:14px">Preferences</div><div style="display:flex;flex-direction:column;gap:16px">';
 h+=rd_switchRow('Rest timer auto-start','rdRestTimer',S.restTimerAuto);
 h+=`<div class="rd-field"><label>Default rest duration</label><select class="rd-select" id="rdRestSeconds"><option value="60" ${S.restTimerSeconds===60?'selected':''}>60 sec</option><option value="90" ${S.restTimerSeconds===90?'selected':''}>90 sec</option><option value="120" ${S.restTimerSeconds===120?'selected':''}>2 min</option><option value="180" ${S.restTimerSeconds===180?'selected':''}>3 min</option></select></div>`;
 h+=rd_switchRow('Weekly summary email','rdWeeklyEmail',S.weeklyEmail);
 h+=`<label class="rd-check-row"><input type="checkbox" id="rdShowWarmups" ${S.showWarmups?'checked':''}> Show warm-up sets in history</label>`;
 h+='</div></div>';
 h+='<div class="rd-eyebrow" style="margin-top:4px">Account</div><div id="rdAccountCard"></div>';
 h+='<div class="rd-eyebrow">Data</div><div class="rd-card pad-0">';
 h+=`<div class="rd-row" style="cursor:default"><div class="body"><div class="name" style="font-size:14px">Install app</div><div class="meta">Add to your home screen.</div></div><button class="rd-btn outline sm" id="rdInstall2">Install</button></div>`;
 h+=`<div class="rd-row" style="cursor:default"><div class="body"><div class="name" style="font-size:14px">Export backup</div><div class="meta">Download every workout and check-in.</div></div><button class="rd-btn outline sm" id="rdExport">Export</button></div>`;
 h+=`<div class="rd-row" style="cursor:default"><div class="body"><div class="name" style="font-size:14px">Import backup</div><div class="meta">Restore a JSON backup on this device.</div></div><button class="rd-btn outline sm" id="rdImportBtn">Import</button><input id="rdImportFile" type="file" accept="application/json" hidden></div>`;
 h+=`<div class="rd-row" style="cursor:default"><div class="body"><div class="name" style="font-size:14px;color:var(--danger)">Reset all data</div><div class="meta">This cannot be undone.</div></div><button class="rd-btn danger-txt outline sm" id="rdReset">Reset</button></div>`;
 h+='</div>';
 h+='<div style="text-align:center;color:var(--stone-400);font-size:9px;letter-spacing:.16em;font-weight:600;margin:10px 0 4px">GYM TRACKER · LOCAL-FIRST PWA</div>';
 h+='<div style="height:8px"></div></div></div>';
 document.getElementById('settings').innerHTML=h;
 document.getElementById('rdSelProgram').onchange=(e)=>rd_selectProgram(e.target.value);
 document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{S.units=b.dataset.unit;save();rd_you()});
 document.getElementById('rdRestTimer').onchange=(e)=>{S.restTimerAuto=e.target.checked;save()};
 document.getElementById('rdRestSeconds').onchange=(e)=>{S.restTimerSeconds=+e.target.value;save()};
 document.getElementById('rdWeeklyEmail').onchange=(e)=>{S.weeklyEmail=e.target.checked;save()};
 document.getElementById('rdShowWarmups').onchange=(e)=>{S.showWarmups=e.target.checked;save()};
 document.getElementById('rdInstall2').onclick=()=>window.deferred?.prompt()||rd_toast('Use your browser menu to install');
 document.getElementById('rdExport').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='gym-tracker-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
 document.getElementById('rdImportBtn').onclick=()=>document.getElementById('rdImportFile').click();
 document.getElementById('rdImportFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.workouts||!data.metrics)throw 0;S=data;S.day=S.day??0;S.active=null;save();rd_toast('Backup restored');rd_you()}catch(_){rd_toast('Invalid backup file')}};r.readAsText(f)};
 document.getElementById('rdReset').onclick=()=>{if(confirm('Delete all workout and body data?')){S={day:0,workouts:[],metrics:[],active:null,programs:[],activeProgram:'builtin',volumeGoals:{},units:'kg',restTimerAuto:true,restTimerSeconds:90,weeklyEmail:false,showWarmups:true};save();rd_you();rd_toast('Reset complete')}};
 window.__rdRenderAccountCard?.();
}
function rd_switchRow(label,id,checked){
 return `<div class="rd-switch-row"><span>${esc(label)}</span><label class="rd-switch"><input type="checkbox" id="${id}" ${checked?'checked':''}><span class="track"></span></label></div>`;
}

/* ---------- Exercise info dialog ---------- */
function rd_openExerciseInfo(i){
 const day=activeDays()[S.day],ex=day[2][i];if(!ex)return;
 const last=rd_lastLabel(ex[0]);
 rd_openDialog(`<div class="rd-dialog-title">${esc(ex[0])}</div><div class="rd-dialog-body">Target ${rd_targetLabel(ex[0])}.${last?`<div style="margin-top:8px">${last}</div>`:''}</div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdInfoClose">Close</button><button class="rd-btn primary sm" id="rdInfoStart">Start here</button></div>`);
 document.getElementById('rdInfoClose').onclick=rd_closeDialog;
 document.getElementById('rdInfoStart').onclick=()=>{rd_closeDialog();rd_startSession(i)};
}

/* ---------- Check-in dialog ---------- */
function rd_openCheckin(){
 rd_openDialog(`<div class="rd-dialog-title">New check-in</div><div style="display:flex;flex-direction:column;gap:14px"><div class="rd-field"><label>Weight</label><div class="rd-input-suffix"><input class="rd-input" id="rdCiWeight" type="number" inputmode="decimal"><span>kg</span></div></div><div class="rd-field"><label>Waist</label><div class="rd-input-suffix"><input class="rd-input" id="rdCiWaist" type="number" inputmode="decimal"><span>cm</span></div></div></div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdCiCancel">Cancel</button><button class="rd-btn primary sm" id="rdCiSave">Save check-in</button></div>`);
 document.getElementById('rdCiCancel').onclick=rd_closeDialog;
 document.getElementById('rdCiSave').onclick=()=>{
  const w=parseFloat(document.getElementById('rdCiWeight').value);
  if(!w)return rd_toast('Enter your weight first');
  const waist=document.getElementById('rdCiWaist').value;
  S.metrics.push({date:today(),weight:w,waist:waist||''});
  S.metrics.sort((a,b)=>a.date.localeCompare(b.date));save();
  rd_closeDialog();rd_toast('Check-in saved');rd_progress();
 };
}

/* ---------- Program builder dialog ---------- */
let rd_builder=null;
function rd_newBuilderDay(){return {label:'',rest:false,exercises:[rd_newBuilderEx()]}}
function rd_newBuilderEx(){return {name:'',sets:'3',min:'8',max:'12',tag:MUSCLE_GROUPS[0]}}
function rd_openBuilder(){rd_builder={name:'',days:[rd_newBuilderDay()]};rd_renderBuilder()}
function rd_renderBuilder(){
 let h='<div class="rd-dialog-title">New split</div><div style="display:flex;flex-direction:column;gap:16px">';
 h+=`<div class="rd-field"><label>Program name</label><input class="rd-input" id="rdBName" value="${esc(rd_builder.name)}" placeholder="e.g. Push / Pull / Legs"></div>`;
 h+='<div style="max-height:44vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding-right:2px">';
 rd_builder.days.forEach((d,di)=>{
  h+=`<div class="rd-builder-day"><div class="rd-builder-row"><div class="rd-field"><label>Day label</label><input class="rd-input" data-b-label="${di}" value="${esc(d.label)}" placeholder="e.g. Push"></div>${rd_builder.days.length>1?`<button class="rd-iconbtn" data-b-rmday="${di}" aria-label="Remove day"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:''}</div>`;
  h+=`<label class="rd-check-row"><input type="checkbox" data-b-rest="${di}" ${d.rest?'checked':''}> Rest day</label>`;
  if(!d.rest){
   d.exercises.forEach((ex,ei)=>{
    h+=`<div class="rd-builder-ex"><div class="rd-builder-row"><input class="rd-input" data-b-exname="${di}-${ei}" value="${esc(ex.name)}" placeholder="Exercise name" style="flex:1"><button class="rd-iconbtn sm" data-b-rmex="${di}-${ei}" aria-label="Remove exercise"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div style="display:flex;gap:8px"><input class="rd-input" data-b-sets="${di}-${ei}" value="${ex.sets}" inputmode="numeric" placeholder="Sets" style="width:56px"><input class="rd-input" data-b-reps="${di}-${ei}" value="${ex.min}" inputmode="numeric" placeholder="Reps" style="width:56px"><select class="rd-select" data-b-tag="${di}-${ei}">${MUSCLE_GROUPS.map(g=>`<option value="${esc(g)}" ${ex.tag===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div></div>`;
   });
   h+=`<button class="rd-btn ghost sm" data-b-addex="${di}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add exercise</button>`;
  }
  h+='</div>';
 });
 h+='</div>';
 h+='<button class="rd-btn outline sm" id="rdBAddDay"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add day</button>';
 h+='</div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdBCancel">Cancel</button><button class="rd-btn primary sm" id="rdBSave">Create split</button></div>';
 document.getElementById('modalbody').innerHTML=h;
 document.getElementById('modalbox').classList.add('wide');
 document.getElementById('modal').classList.remove('hidden');
 rd_bindBuilder();
}
function rd_bindBuilder(){
 document.getElementById('rdBName').oninput=e=>rd_builder.name=e.target.value;
 document.querySelectorAll('[data-b-label]').forEach(i=>i.oninput=()=>rd_builder.days[+i.dataset.bLabel].label=i.value);
 document.querySelectorAll('[data-b-rest]').forEach(i=>i.onchange=()=>{rd_builder.days[+i.dataset.bRest].rest=i.checked;rd_renderBuilder()});
 document.querySelectorAll('[data-b-exname]').forEach(i=>i.oninput=()=>{const[di,ei]=i.dataset.bExname.split('-').map(Number);rd_builder.days[di].exercises[ei].name=i.value});
 document.querySelectorAll('[data-b-sets]').forEach(i=>i.oninput=()=>{const[di,ei]=i.dataset.bSets.split('-').map(Number);rd_builder.days[di].exercises[ei].sets=i.value});
 document.querySelectorAll('[data-b-reps]').forEach(i=>i.oninput=()=>{const[di,ei]=i.dataset.bReps.split('-').map(Number);rd_builder.days[di].exercises[ei].min=i.value;rd_builder.days[di].exercises[ei].max=i.value});
 document.querySelectorAll('[data-b-tag]').forEach(i=>i.onchange=()=>{const[di,ei]=i.dataset.bTag.split('-').map(Number);rd_builder.days[di].exercises[ei].tag=i.value});
 document.querySelectorAll('[data-b-rmday]').forEach(b=>b.onclick=()=>{if(rd_builder.days.length>1){rd_builder.days.splice(+b.dataset.bRmday,1);rd_renderBuilder()}});
 document.querySelectorAll('[data-b-addex]').forEach(b=>b.onclick=()=>{const di=+b.dataset.bAddex;if(rd_builder.days[di].exercises.length<6){rd_builder.days[di].exercises.push(rd_newBuilderEx());rd_renderBuilder()}});
 document.querySelectorAll('[data-b-rmex]').forEach(b=>b.onclick=()=>{const[di,ei]=b.dataset.bRmex.split('-').map(Number);if(rd_builder.days[di].exercises.length>1){rd_builder.days[di].exercises.splice(ei,1);rd_renderBuilder()}});
 document.getElementById('rdBAddDay').onclick=()=>{if(rd_builder.days.length<4){rd_builder.days.push(rd_newBuilderDay());rd_renderBuilder()}else rd_toast('Max 4 days per split')};
 document.getElementById('rdBCancel').onclick=()=>{document.getElementById('modalbox').classList.remove('wide');rd_closeDialog()};
 document.getElementById('rdBSave').onclick=rd_saveBuilder;
}
function rd_saveBuilder(){
 if(!rd_builder.name.trim())return rd_toast('Name your split first');
 const days=rd_builder.days.map((d,i)=>{
  if(d.rest||!d.exercises.some(ex=>ex.name.trim()))return [`DAY ${i+1} — REST`,'Recovery',[]];
  const label=(d.label.trim()||'TRAINING').toUpperCase();
  const exercises=d.exercises.filter(ex=>ex.name.trim()).map(ex=>[ex.name.trim(),`${parseInt(ex.sets)||3} × ${parseInt(ex.min)||8}-${parseInt(ex.max)||12}`,'1-2',ex.tag.trim()||'General']);
  return [`DAY ${i+1} — ${label}`,'',exercises];
 });
 if(!days.some(d=>d[2].length))return rd_toast('Add at least one exercise');
 const id='custom-'+Date.now();
 S.programs=S.programs||[];S.programs.push({id,name:rd_builder.name.trim(),days});
 S.activeProgram=id;S.day=0;S.active=null;save();rd_builder=null;
 document.getElementById('modalbox').classList.remove('wide');
 rd_closeDialog();rd_toast('Split created');
 const activeView=document.querySelector('.bottom-nav button.active')?.dataset.v;
 if(activeView==='program')rd_program();
}

/* ---------- Live session (full-screen) ---------- */
function rd_ensureSessionEl(){
 let el=document.getElementById('rdSession');
 if(!el){el=document.createElement('div');el.id='rdSession';el.className='rd-session hidden';document.body.appendChild(el)}
 return el;
}
function rd_sessionEntries(){S.active=S.active||{day:S.day,mode:'session',entries:{}};S.active.entries=S.active.entries||{};return S.active.entries}
function rd_startSession(exIndex){
 const day=activeDays()[S.day];
 if(!day[2].length)return;
 if(!(S.active&&S.active.day===S.day&&S.active.mode==='session')){S.active={day:S.day,mode:'session',exIndex,entries:{},startedAt:Date.now()}}
 else S.active.exIndex=exIndex;
 save();
 rd_renderSession();
}
function rd_exitSession(){
 const total=Object.values(rd_sessionEntries()).reduce((a,l)=>a+(l.sets?.length||0),0);
 if(total>0){rd_openEndConfirm();return}
 clearInterval(window.__rdRestInt);
 S.active=null;save();
 rd_ensureSessionEl().classList.add('hidden');
}
function rd_openEndConfirm(){
 const total=Object.values(rd_sessionEntries()).reduce((a,l)=>a+(l.sets?.length||0),0);
 rd_openDialog(`<div class="rd-dialog-title">End this session?</div><div class="rd-dialog-body">Your ${total} logged set${total===1?'':'s'} ${total===1?'is':'are'} saved either way.</div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdEndKeep">Keep going</button><button class="rd-btn primary sm" id="rdEndNow">End session</button></div>`);
 document.getElementById('rdEndKeep').onclick=rd_closeDialog;
 document.getElementById('rdEndNow').onclick=()=>{rd_closeDialog();rd_finishSession()};
}
function rd_renderSession(){
 const day=activeDays()[S.day],exIndex=S.active.exIndex,ex=day[2][exIndex];
 if(!ex){S.active=null;save();rd_ensureSessionEl().classList.add('hidden');return}
 const entries=rd_sessionEntries();
 const logs=entries[exIndex]?.sets||[];
 const r=rd_rangeFor(ex[0]);
 const last=lastForExercise(ex[0]);
 const lastSet=last?.sets?.[last.sets.length-1];
 const stepKey='__step_'+exIndex;
 if(!window[stepKey]){
  window[stepKey]={w:lastSet?parseFloat(lastSet.w)||20:20,r:lastSet?parseInt(lastSet.r)||r.min:r.min};
 }
 const step=window[stepKey];
 const el=rd_ensureSessionEl();
 let h=`<div class="rd-session-head"><div class="rd-session-topbar"><button class="rd-iconbtn onDark" id="rdExitSession" aria-label="Exit session"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button><span class="rd-session-daylabel">${esc(day[0].replace(/^DAY \d+ — /,''))}</span><div style="width:40px"></div></div><div class="rd-session-info"><div class="rd-session-nav"><button class="rd-iconbtn onDark" id="rdPrevEx" aria-label="Previous exercise" ${exIndex===0?'disabled':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button><button class="rd-session-exof" id="rdExList" aria-label="Jump to exercise">Exercise ${exIndex+1} of ${day[2].length}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button><button class="rd-iconbtn onDark" id="rdNextEx" aria-label="Skip to next exercise" ${exIndex>=day[2].length-1?'disabled':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></button></div><div class="rd-session-exname">${esc(ex[0])}</div><div class="rd-progress-track" style="margin-top:16px;background:rgba(244,242,237,.18)"><div class="rd-progress-fill" style="background:var(--stone-300);width:${Math.min(100,Math.round(logs.length/r.sets*100))}%"></div></div><div class="rd-session-target"><span>Target</span><span>${rd_targetLabel(ex[0])}</span></div></div></div>`;
 h+='<div class="rd-session-body">';
 h+=`<div style="margin-bottom:16px"><span class="rd-tag selected">${esc(ex[3])}</span></div>`;
 if(lastSet)h+=`<div class="rd-session-last">Last time: ${esc(lastSet.w)}kg × ${esc(lastSet.r)} × ${last.sets.length}</div>`;
 if(!logs.length)h+='<div class="rd-session-empty">Nothing logged yet. Start with one set.</div>';
 logs.forEach((l,i)=>{h+=`<div class="rd-set-row rd-fade" data-edit-set="${i}" role="button" tabindex="0" aria-label="Edit set ${i+1}: ${esc(l.w)}kg by ${esc(l.r)} reps"><span class="idx">${i+1}</span><span class="vals">${esc(l.w)} kg × ${esc(l.r)}</span>${l.pr?'<span class="rd-badge rd-badge-success">PR</span>':''}<button class="rd-iconbtn sm" data-del-set="${i}" aria-label="Delete set ${i+1}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`});
 h+='<div style="height:16px"></div></div>';
 const timer=S.active.timer;
 h+='<div class="rd-session-bottom">';
 if(timer){
  const left=timer.paused?Math.max(0,timer.end-timer.pausedAt):Math.max(0,timer.end-Date.now());
  const sec=Math.ceil(left/1000);
  h+=`<div class="rd-rest-timer"><div class="rd-rest-ring"><span id="rdRestVal">${String(Math.floor(sec/60)).padStart(1,'0')}:${String(sec%60).padStart(2,'0')}</span></div><div class="rd-rest-info"><b>Resting</b><span>Next set when you're ready.</span></div><div class="rd-rest-actions"><button data-rest="plus">+30</button><button data-rest="pause">${timer.paused?'Resume':'Pause'}</button><button data-rest="skip">Skip</button></div></div>`;
 } else {
  h+='<button class="rd-manual-rest" id="rdManualRest">Start rest timer</button>';
 }
 h+=`<div class="rd-stepper-row">
  <div class="rd-stepper"><span class="lbl">Weight</span><div class="rd-stepper-ctrl"><button data-step="w-" aria-label="Decrease weight">−</button><span class="rd-stepper-val" id="rdStepWVal">${step.w} kg</span><button data-step="w+" aria-label="Increase weight">+</button></div></div>
  <div class="rd-stepper"><span class="lbl">Reps</span><div class="rd-stepper-ctrl"><button data-step="r-" aria-label="Decrease reps">−</button><span class="rd-stepper-val" id="rdStepRVal">${step.r}</span><button data-step="r+" aria-label="Increase reps">+</button></div></div>
 </div><div class="rd-session-actions"><button class="rd-btn primary lg" id="rdLogSet"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>Log set</button><button class="rd-btn outline lg" id="rdAdvance">${exIndex>=day[2].length-1?'Finish workout':'Next exercise'}</button></div></div>`;
 el.innerHTML=h;
 el.classList.remove('hidden');
 if(timer)rd_tickRestTimer();
 document.getElementById('rdManualRest')?.addEventListener('click',()=>rd_startRestTimer());
 document.querySelectorAll('[data-rest]').forEach(b=>b.onclick=()=>{
  const t=S.active.timer;if(!t)return;
  const a=b.dataset.rest;
  if(a==='plus'){t.end+=30000;save()}
  else if(a==='skip'){S.active.timer=null;save();clearInterval(window.__rdRestInt);rd_renderSession()}
  else if(a==='pause'){
   if(t.paused){t.end+=Date.now()-t.pausedAt;t.paused=false;t.pausedAt=null}
   else{t.paused=true;t.pausedAt=Date.now()}
   save();rd_renderSession();
  }
 });
 document.getElementById('rdExitSession').onclick=rd_exitSession;
 document.getElementById('rdExList').onclick=rd_openSessionExerciseList;
 document.getElementById('rdPrevEx').onclick=()=>{if(exIndex>0){S.active.exIndex=exIndex-1;save();rd_renderSession()}};
 document.getElementById('rdNextEx').onclick=()=>{if(exIndex<day[2].length-1){S.active.exIndex=exIndex+1;save();rd_renderSession()}};
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.step;
  if(a==='w-')step.w=Math.max(0,step.w-2.5);
  if(a==='w+')step.w=step.w+2.5;
  if(a==='r-')step.r=Math.max(0,step.r-1);
  if(a==='r+')step.r=step.r+1;
  document.getElementById('rdStepWVal').textContent=step.w+' kg';
  document.getElementById('rdStepRVal').textContent=step.r;
 });
 document.getElementById('rdLogSet').onclick=()=>{
  const isPr=step.w>rd_bestWeight(ex[0])&&step.w>0;
  entries[exIndex]=entries[exIndex]||{sets:[]};
  entries[exIndex].sets.push({w:step.w,r:step.r,pr:isPr});
  save();
  rd_haptic(isPr?[15,60,15]:12);
  rd_toast(isPr?`New PR — ${step.w}kg × ${step.r}`:`Set logged — ${step.w}kg × ${step.r}`);
  if(S.restTimerAuto)rd_startRestTimer();else rd_renderSession();
 };
 document.querySelectorAll('[data-edit-set]').forEach(row=>{
  row.onclick=()=>rd_openSetEditor(exIndex,+row.dataset.editSet);
  row.onkeydown=(e)=>{if((e.key==='Enter'||e.key===' ')&&e.target===row){e.preventDefault();rd_openSetEditor(exIndex,+row.dataset.editSet)}};
 });
 document.querySelectorAll('[data-del-set]').forEach(b=>b.onclick=(e)=>{
  e.stopPropagation();
  const i=+b.dataset.delSet;
  entries[exIndex].sets.splice(i,1);
  save();
  rd_toast('Set removed');
  rd_renderSession();
 });
 document.getElementById('rdAdvance').onclick=()=>{
  if(exIndex>=day[2].length-1){rd_finishSession();return}
  S.active.exIndex=exIndex+1;save();rd_renderSession();
 };
}
function rd_startRestTimer(seconds){
 S.active.timer={end:Date.now()+(seconds||S.restTimerSeconds||90)*1000,paused:false,pausedAt:null};
 save();
 rd_renderSession();
}
function rd_tickRestTimer(){
 clearInterval(window.__rdRestInt);
 window.__rdRestInt=setInterval(()=>{
  const t=S.active?.timer;
  if(!t){clearInterval(window.__rdRestInt);return}
  if(t.paused)return;
  const left=Math.max(0,t.end-Date.now());
  if(left<=0){
   S.active.timer=null;save();
   clearInterval(window.__rdRestInt);
   rd_haptic([40,80,40]);
   rd_toast('Rest complete — next set');
   rd_renderSession();
   return;
  }
  const el=document.getElementById('rdRestVal');
  if(el){const sec=Math.ceil(left/1000);el.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
 },500);
}
function rd_openSetEditor(exIndex,setIndex){
 const entries=rd_sessionEntries();
 const set=entries[exIndex]?.sets?.[setIndex];if(!set)return;
 const exName=activeDays()[S.day][2][exIndex][0];
 rd_openDialog(`<div class="rd-dialog-title">Edit set ${setIndex+1}</div><div style="display:flex;gap:12px;margin-bottom:16px"><div class="rd-field" style="flex:1"><label>Weight kg</label><input class="rd-input" id="rdSetW" type="number" inputmode="decimal" value="${esc(set.w)}"></div><div class="rd-field" style="flex:1"><label>Reps</label><input class="rd-input" id="rdSetR" type="number" inputmode="numeric" value="${esc(set.r)}"></div></div><div class="rd-dialog-footer"><button class="rd-btn danger-txt outline sm" id="rdSetDelete" style="margin-right:auto">Delete</button><button class="rd-btn ghost sm" id="rdSetCancel">Cancel</button><button class="rd-btn primary sm" id="rdSetSave">Save</button></div>`);
 document.getElementById('rdSetCancel').onclick=rd_closeDialog;
 document.getElementById('rdSetDelete').onclick=()=>{entries[exIndex].sets.splice(setIndex,1);save();rd_closeDialog();rd_toast('Set removed');rd_renderSession()};
 document.getElementById('rdSetSave').onclick=()=>{
  const w=parseFloat(document.getElementById('rdSetW').value)||0;
  const r=parseInt(document.getElementById('rdSetR').value)||0;
  set.w=w;set.r=r;set.pr=w>0&&w>rd_bestWeight(exName);
  save();rd_closeDialog();rd_toast('Set updated');rd_renderSession();
 };
}
function rd_openSessionExerciseList(){
 const day=activeDays()[S.day],entries=rd_sessionEntries(),cur=S.active.exIndex;
 let body='';
 day[2].forEach((ex,i)=>{
  const r=rd_rangeFor(ex[0]);
  const done=(entries[i]?.sets||[]).length,met=done>=r.sets;
  body+=`<button class="rd-row${i===cur?' current':''}" data-jump-ex="${i}"><span class="num">${String(i+1).padStart(2,'0')}</span><div class="body"><div class="name">${esc(ex[0])}${i===cur?' · current':''}</div><div class="meta">${done}/${r.sets} sets logged</div></div>${met?'<span class="rd-badge rd-badge-success">✓</span>':''}</button>`;
 });
 rd_openDialog(`<div class="rd-dialog-title">Jump to exercise</div><div class="rd-card pad-0">${body}</div><div class="rd-dialog-footer"><button class="rd-btn ghost sm" id="rdJumpClose">Close</button></div>`);
 document.getElementById('rdJumpClose').onclick=rd_closeDialog;
 document.querySelectorAll('[data-jump-ex]').forEach(b=>b.onclick=()=>{
  const i=+b.dataset.jumpEx;
  if(i!==S.active.exIndex){S.active.exIndex=i;save()}
  rd_closeDialog();rd_renderSession();
 });
}
function rd_finishSession(){
 const day=activeDays()[S.day],entries=rd_sessionEntries();
 const rows=[];let allSets=[];
 day[2].forEach((ex,i)=>{
  const sets=entries[i]?.sets||[];
  if(sets.length){rows.push({exercise:ex[0],sets:sets.map(s=>({w:s.w,r:s.r,pr:!!s.pr})),summary:sets.map(s=>`${s.w}×${s.r}`).join(', '),pr:sets.some(s=>s.pr)});allSets=allSets.concat(sets)}
 });
 if(!rows.length){rd_toast('Log at least one set first');return}
 const prCount=allSets.filter(s=>s.pr).length;
 const durationMin=S.active?.startedAt?Math.max(1,Math.round((Date.now()-S.active.startedAt)/60000)):null;
 const workoutRec={date:today(),day:day[0],entries:rows,prs:new Array(prCount).fill('PR')};
 if(durationMin!=null)workoutRec.duration=durationMin;
 S.workouts.push(workoutRec);
 clearInterval(window.__rdRestInt);
 S.active=null;save();
 rd_ensureSessionEl().classList.add('hidden');
 rd_showCompletion(workoutRec,day[2].length);
}

/* ---------- Workout complete (full-screen) ---------- */
function rd_ensureCompleteEl(){
 let el=document.getElementById('rdComplete');
 if(!el){el=document.createElement('div');el.id='rdComplete';el.className='rd-complete hidden';document.body.appendChild(el)}
 return el;
}
function rd_showCompletion(workoutRec,totalExercises){
 const rows=workoutRec.entries||[];
 const sets=rows.reduce((a,e)=>a+e.sets.length,0);
 const reps=rows.reduce((a,e)=>a+e.sets.reduce((b,s)=>b+(+s.r||0),0),0);
 const prRows=rows.filter(e=>e.pr).map(e=>{
  const best=e.sets.filter(s=>s.pr).reduce((b,s)=>(parseFloat(s.w)||0)>(parseFloat(b.w)||0)?s:b,e.sets.find(s=>s.pr));
  return {exercise:e.exercise,w:best.w,r:best.r};
 });
 const dayName=esc(workoutRec.day.replace(/^DAY \d+ — /,''));
 const stats=workoutRec.duration!=null
  ?[['Duration',`${workoutRec.duration}<small>min</small>`],['Sets',sets],['Reps',reps]]
  :[['Sets',sets],['Reps',reps],['Exercises',`${rows.length}<small>/ ${totalExercises}</small>`]];
 let h='<div class="rd-complete-body">';
 h+='<div class="rd-complete-mark rd-pop"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>';
 h+=`<div class="rd-eyebrow">Workout complete</div><h1 class="rd-h1" style="margin-bottom:4px">${dayName}</h1>`;
 h+=`<div style="font-size:13px;color:var(--stone-500);margin-bottom:22px">${rows.length} of ${totalExercises} exercise${totalExercises===1?'':'s'} logged</div>`;
 h+=`<div class="rd-stat-grid">${stats.map(([lbl,val])=>`<div class="rd-stat-tile"><span class="lbl">${esc(lbl)}</span><span class="val">${val}</span></div>`).join('')}</div>`;
 if(prRows.length){
  h+='<div class="rd-eyebrow" style="margin:26px 0 10px">New PR</div>';
  prRows.forEach((p,i)=>{h+=`<div class="rd-pr-card rd-fade" style="animation-delay:${Math.min(i*60,240)}ms"><span class="name">${esc(p.exercise)}</span><span class="val">${esc(p.w)}kg × ${esc(p.r)}</span></div>`});
 }
 h+='<div class="rd-eyebrow" style="margin:26px 0 2px">Logged</div><div>';
 rows.forEach(e=>{h+=`<div class="rd-complete-exrow"><span class="name">${esc(e.exercise)}</span><span class="val">${esc(e.summary||'')}</span></div>`});
 h+='</div>';
 h+='<div style="height:8px"></div></div>';
 h+='<div class="rd-complete-bottom"><button class="rd-btn primary lg full" id="rdCompleteDone">Done</button></div>';
 const el=rd_ensureCompleteEl();
 el.innerHTML=h;
 el.classList.remove('hidden');
 rd_haptic(25);
 document.getElementById('rdCompleteDone').onclick=rd_closeCompletion;
}
function rd_closeCompletion(){
 rd_ensureCompleteEl().classList.add('hidden');
 rd_toast('Workout saved — nice work');
 rd_today();
}

/* ---------- wire up ---------- */
window.workout=rd_today;window.program=rd_program;window.progress=rd_progress;window.history=rd_history;window.settings=rd_you;
const origRender=window.render;
window.render=function(v){origRender(v)};

setTimeout(()=>{
 if(S.active&&S.active.mode==='session'&&activeDays()[S.day]?.[2]?.length){rd_renderSession()}
 const activeBtn=document.querySelector('.bottom-nav button.active')?.dataset.v||'workout';
 window.render(activeBtn);
},0);
})();
