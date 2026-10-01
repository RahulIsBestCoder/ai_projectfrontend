'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bookmark, ChevronDown, ChevronLeft, ChevronsLeft, Search, SlidersHorizontal, ArrowLeftRight, FlaskConical, RefreshCw } from 'lucide-react';
import { listSprints } from '@core/services';
import { loadTaigaBoard, syncTaigaData, BoardData, BoardTask, BoardIssue } from '@core/services/taigaBoard';
import { TaigaSprint } from '@shared/models';
import '@/styles/taiga-board.css';

const date = (v: string) => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';
export const WorkItemsBoard: React.FC<{projectId:string;onToast:(message:string)=>void}> = ({projectId,onToast}) => {
  const [view,setView]=useState<'board'|'issues'>('board');
  useEffect(()=>setView('board'),[projectId]);
  const [data,setData]=useState<BoardData|null>(null), [sprints,setSprints]=useState<TaigaSprint[]>([]), [selected,setSelected]=useState('');
  const [error,setError]=useState(''), [revision,setRevision]=useState(0), [query,setQuery]=useState(''), [filters,setFilters]=useState(false), [status,setStatus]=useState('all');
  const [zoom,setZoom]=useState('detailed'), [collapsed,setCollapsed]=useState<Set<string>>(new Set()), [menu,setMenu]=useState(true), [detail,setDetail]=useState<BoardTask|null>(null);
  useEffect(()=>{let live=true;setData(null);setError('');setDetail(null);setQuery('');setStatus('all');setCollapsed(new Set());
    Promise.all([loadTaigaBoard(projectId),listSprints(projectId)]).then(([board,rows])=>{if(!live)return;setData(board);const ordered=rows.filter(s=>s.taigaMilestoneId!=null).sort((a,b)=>b.startDate.localeCompare(a.startDate));setSprints(ordered);setSelected(current=>ordered.some(s=>s.id===current)?current:ordered[0]?.id||'');}).catch(e=>{if(live)setError(e.message||'Unable to load Taiga board.');});return()=>{live=false};
  },[projectId,revision]);
  const [syncing,setSyncing]=useState(false), [lastSynced,setLastSynced]=useState<Date|null>(null);
  const syncFromTaiga=async()=>{
    if(syncing)return;
    setSyncing(true);
    try{const result=await syncTaigaData(projectId);setLastSynced(new Date());onToast(`${result.message}${result.itemsSynced?` (${result.itemsSynced} items)`:''}`);setRevision(v=>v+1);}
    catch(e:any){onToast(e?.status===409?'A sync is already running for this project. Try again shortly.':e?.msg||e?.message||'Taiga sync failed');}
    finally{setSyncing(false);}
  };
  const syncButton=<button type="button" className="tg-sync" onClick={()=>void syncFromTaiga()} disabled={syncing} aria-busy={syncing} title="Fetch the latest tasks, sprints and issues from Taiga"><RefreshCw size={15} className={syncing?'tg-spin':undefined}/> {syncing?'Syncing Taiga…':'Sync Taiga'}</button>;
  const sprint=sprints.find(s=>s.id===selected);
  const tasks=useMemo(()=>data?.tasks.filter(t=>sprint ? String(t.taiga_milestone_id)===String(sprint.taigaMilestoneId) : t.taiga_milestone_id == null)||[],[data,sprint]);
  const lanes=useMemo(()=>{const map=new Map<string,{id:string;ref:number|null;name:string;tasks:BoardTask[]}>();for(const task of tasks){const id=String(task.user_story_id??'storyless');if(!map.has(id))map.set(id,{id,ref:task.user_story_ref,name:task.user_story_subject||'User story',tasks:[]});map.get(id)!.tasks.push(task);}const storyless=map.get('storyless')||{id:'storyless',ref:null,name:'Storyless tasks',tasks:[]};map.delete('storyless');return [...map.values(),{...storyless,name:'Storyless tasks'}];},[tasks]);
  const closed=tasks.filter(t=>t.is_closed).length, total=sprint?.totalPoints||0, completed=sprint?.completedPoints||0, progress=total?Math.round(completed/total*100):0;
  const toggle=(id:string)=>setCollapsed(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});
  if(error)return <div className="tg-message" role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>Retry</button>{syncButton}</div>;
  if(!data)return <div className="tg-message" role="status">Loading Taiga sprint board…</div>;
  const grid={gridTemplateColumns:`292px repeat(${data.columns.length}, minmax(230px, 1fr))`, minWidth:292 + data.columns.length * 235};
  return <div className={`tg-app ${menu?'':'tg-menu-hidden'}`}>
    <aside className="tg-sidebar"><strong className="tg-project"><span>▧</span>{data.name}</strong><div className="tg-scrum"><RefreshCw size={21}/> Scrum <ChevronDown size={14}/></div><button className={view==='board'&&!selected?'active':''} onClick={()=>{setSelected('');setView('board');}}>Backlog</button><nav aria-label="Sprints">{sprints.map(s=><button className={view==='board'&&s.id===selected?'active':''} key={s.id} onClick={()=>{setSelected(s.id);setDetail(null);setView('board');}}>{s.name}</button>)}</nav><button type="button" className={`tg-issues-nav ${view==='issues'?'active':''}`} aria-pressed={view==='issues'} onClick={()=>{setView('issues');setDetail(null);}}><Bookmark/> Issues</button><button className="tg-collapse" onClick={()=>setMenu(false)}>collapse menu <ChevronsLeft size={16}/></button></aside>
    <main className="tg-main">{!menu&&<button className="tg-show-menu" onClick={()=>setMenu(true)}>Show menu</button>}
      {view==='issues'?<IssuesView issues={data.issues} onRefresh={()=>setRevision(v=>v+1)} syncButton={syncButton}/>:<>
      <header className="tg-title"><h2>{sprint?.name||'Backlog'}</h2><span className="tg-readonly-label" title="Tasks are synced from Taiga and cannot be edited here">Read only</span>{sprint&&<span>{date(sprint.startDate)} to {date(sprint.endDate)}</span>}<button title="Reload board from saved data" aria-label="Reload board" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/></button>{syncButton}{lastSynced&&<span className="tg-synced">Synced {lastSynced.toLocaleTimeString()}</span>}</header>
      <section className="tg-summary" aria-label="Sprint totals"><div className="tg-percent">{progress}% <ChevronDown size={14}/></div><Metric value={total} label="total points"/><Metric value={completed} label="completed points"/><Metric value={tasks.length-closed} label="open tasks"/><Metric value={closed} label="closed tasks"/><ArrowLeftRight/><FlaskConical size={18}/><Metric value={0} label="iocaine doses"/><BarChart3 className="tg-chart"/></section>
      <div className="tg-toolbar"><button aria-expanded={filters} onClick={()=>setFilters(v=>!v)}><SlidersHorizontal size={15}/> Filters</button><label className="tg-search"><input aria-label="Search subject or reference" placeholder="subject or reference" value={query} onChange={e=>setQuery(e.target.value)}/><Search size={15}/></label>{filters&&<select aria-label="Filter task status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{data.columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}<div className="tg-zoom">ZOOM: {['compact','normal','detailed','expanded'].map(z=><button key={z} aria-label={`${z} zoom`} aria-pressed={zoom===z} className={zoom===z?'active':''} onClick={()=>setZoom(z)}>{zoom===z?z:''}</button>)}</div></div>
      <div className="tg-board-scroll"><div className="tg-grid tg-head" style={grid}><div>User story</div>{data.columns.map((c,i)=><div key={c.id} style={{borderColor:c.color||['#777493','#f58159','#dfd348','#9ce43a','#587be1'][i%5]}}>{c.name}<ChevronLeft size={14}/></div>)}</div>
      {!sprint&&<div className="tg-empty">Tasks without a sprint</div>}
      {lanes.map(lane=><div className={`tg-grid tg-lane tg-${zoom} ${collapsed.has(lane.id)?'tg-folded':''}`} style={grid} key={lane.id}><div className="tg-story"><button aria-label={`${collapsed.has(lane.id)?'Expand':'Collapse'} ${lane.name}`} aria-expanded={!collapsed.has(lane.id)} onClick={()=>toggle(lane.id)}><ChevronDown size={14} style={{transform:collapsed.has(lane.id)?'rotate(-90deg)':undefined}}/></button><span>{lane.ref!=null&&<b>#{lane.ref} </b>}{lane.name}</span></div>{data.columns.map(c=><div className="tg-cell" key={c.id}>{!collapsed.has(lane.id)&&lane.tasks.filter(t=>t.status===c.id&&(status==='all'||String(t.status)===status)&&`${t.subject} #${t.ref}`.toLowerCase().includes(query.toLowerCase())).map(t=><button className={`tg-task ${t.is_blocked?'tg-blocked':''}`} key={t._id} onClick={()=>setDetail(t)} title={`#${t.ref} ${t.subject}`}><div><b>#{t.ref}</b> {t.subject}</div>{zoom!=='compact'&&<footer><span>{(t.tags||[]).map(tag=>Array.isArray(tag)?tag[0]:tag).join(' · ')}</span><span className="tg-avatar" title={t.assigned_to_full_name||t.assigned_to_username||'Unassigned'}>{(t.assigned_to_full_name||t.assigned_to_username||'◇').slice(0,1).toUpperCase()}</span></footer>}</button>)}</div>)}</div>)}
      </div>
      {detail&&<div className="tg-detail" role="region" aria-label={`Task ${detail.ref}`}><button onClick={()=>setDetail(null)} autoFocus>Close</button><h3>#{detail.ref} {detail.subject}</h3><p>{detail.status_name} · {detail.assigned_to_full_name||detail.assigned_to_username||'Unassigned'}</p><p>{detail.user_story_subject||'Storyless task'}</p>{detail.is_blocked&&<p>Blocked</p>}</div>}
      </>}
    </main>
  </div>;
};
function Metric({value,label}:{value:number;label:string}){return <div className="tg-metric"><strong>{value}</strong><span>{label}</span></div>}

function IssuesView({issues,onRefresh,syncButton}:{issues:BoardIssue[];onRefresh:()=>void;syncButton:React.ReactNode}) {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const visible=issues.filter(issue=>(filter==='all'||(filter==='closed'?issue.is_closed:!issue.is_closed))&&('#'+(issue.ref??'')+' '+issue.subject).toLowerCase().includes(search.toLowerCase()));
  return <section aria-label="Project issues">
    <header className="tg-title"><h2>Issues</h2><span className="tg-readonly-label">Read only</span><button aria-label="Reload issues" title="Reload issues from saved data" onClick={onRefresh}><RefreshCw size={16}/></button>{syncButton}</header>
    <div className="tg-toolbar"><label className="tg-search"><input aria-label="Search issues" placeholder="subject or reference" value={search} onChange={e=>setSearch(e.target.value)}/><Search size={15}/></label><select aria-label="Filter issues" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All issues</option><option value="open">Open</option><option value="closed">Closed</option></select><span>{visible.length} issues</span></div>
    {visible.length===0?<p className="tg-empty">{issues.length?'No issues match your filters.':'No synced Taiga issues for this project.'}</p>:<div className="tg-issue-list">{visible.map(issue=><details key={issue._id} className="tg-issue-row"><summary><span><b>{issue.ref!=null?('#'+issue.ref+' '):''}</b>{issue.subject}</span><span>{issue.status_name||(issue.is_closed?'Closed':'Open')}</span></summary><div><p>{issue.assigned_to_full_name||issue.assigned_to_username||'Unassigned'}</p><p className="tg-issue-description">{issue.description||'No description available.'}</p></div></details>)}</div>}
  </section>;
}
