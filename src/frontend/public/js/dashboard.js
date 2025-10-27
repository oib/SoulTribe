(()=>{const ot=a=>document.getElementById(a);function Rt(a){try{const s=String(a).split("/");return s[s.length-1].replace(/_/g," ")}catch(s){return a}}const Et=15e3;function Q(a){try{return!a||typeof a!="string"?!1:(new Intl.DateTimeFormat("en-US",{timeZone:a}),!0)}catch(s){return!1}}function vt(a,s,e){try{if(!a||s===""||s===null||s===void 0)return null;const[o,i,n]=String(a).split("-").map(g=>parseInt(g,10)),d=parseInt(s,10);if(!o||!i||!n||isNaN(d))return null;const t=`${a}T${String(d).padStart(2,"0")}:00:00`,r=ut(new Date(t),e),c=Date.UTC(o,i-1,n,d,0,0,0)-r*6e4;return new Date(c).toISOString().replace(/\.\d{3}Z$/,"Z")}catch(o){return null}}function ut(a,s){var e;try{const d=(((e=new Intl.DateTimeFormat("en-US",{timeZone:s,hour:"2-digit",minute:"2-digit",timeZoneName:"shortOffset"}).formatToParts(a).find(g=>g.type==="timeZoneName"))==null?void 0:e.value)||"").match(/([+-])(\d{1,2})(?::?(\d{2}))?/);if(!d)return 0;const t=d[1]==="-"?-1:1,r=parseInt(d[2]||"0",10),c=parseInt(d[3]||"0",10);return t*(r*60+c)}catch(o){return 0}}function k(a,s){try{const e=new Date(String(s)),o=ut(e,a),i=o<0?"-":"+",n=Math.abs(o),d=String(Math.floor(n/60)).padStart(2,"0"),t=String(n%60).padStart(2,"0");return`UTC${i}${d}:${t}`}catch(e){return""}}function $t(){let a=null;try{a=window.liveTz||null}catch(s){}if(!a)try{a=localStorage.getItem("live_tz")}catch(s){}if(!a)try{a=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(s){}return a||"UTC"}function it(){try{const a=document.getElementById("tzTopBadgeText");if(!a)return;const s=$t(),e=k(s,new Date().toISOString());a.textContent=`Using timezone: ${s}${e?` (${e})`:""}`}catch(a){}}function Ot(a){try{const s=String(a);return/Z$|[\+\-]\d{2}:?\d{2}$/.test(s)?new Date(s):new Date(s+"Z")}catch(s){return new Date(a)}}function Y(a){try{const s=String(a),e=s.indexOf("T");return e>0?s.slice(0,e):s}catch(s){return String(a)}}function J(a){try{const s=String(a),e=s.indexOf("T");if(e<0)return s;const o=s.slice(e+1),i=o.slice(0,2),n=o.slice(3,5);if(!/^[0-9]{2}$/.test(i)||!/^[0-9]{2}$/.test(n)){const d=new Date(a),t=String(d.getHours()).padStart(2,"0"),r=String(d.getMinutes()).padStart(2,"0");return`${t}:${r}`}return`${i}:${n}`}catch(s){try{const e=new Date(a),o=String(e.getHours()).padStart(2,"0"),i=String(e.getMinutes()).padStart(2,"0");return`${o}:${i}`}catch(e){return String(a)}}}function mt(a,s){try{const e=new Date(s).getTime()-new Date(a).getTime(),o=Math.max(0,Math.round(e/6e4)),i=Math.floor(o/60),n=o%60;return i>0&&n===0?i===1?"1 hour":`${i} hours`:i>0&&n>0?`${i}h ${n}m`:`${n}m`}catch(e){return""}}function rt(a){try{if(!a)return"";const s=new Date(a),e=s.getUTCFullYear(),o=String(s.getUTCMonth()+1).padStart(2,"0"),i=String(s.getUTCDate()).padStart(2,"0"),n=String(s.getUTCHours()).padStart(2,"0"),d=String(s.getUTCMinutes()).padStart(2,"0");return`${e}-${o}-${i} ${n}:${d} UTC`}catch(s){return""}}const z=a=>String(a).padStart(2,"0");function zt(a,s){try{if(!a||s===""||s===null||s===void 0)return null;const[e,o,i]=String(a).split("-").map(t=>parseInt(t,10)),n=parseInt(s,10);return!e||!o||!i||isNaN(n)?null:new Date(e,o-1,i,n,0,0,0).toISOString().replace(/\.\d{3}Z$/,"Z")}catch(e){return null}}function pt(a){try{if(!a||!a.options||a.options.length)return;for(let s=0;s<24;s++){const e=document.createElement("option");e.value=String(s),e.textContent=`${z(s)}:00`,a.appendChild(e)}}catch(s){}}const b=window.api,S=window.show,w=(...a)=>{try{const s=typeof window!="undefined"?window.toast:null;if(typeof s=="function")return s(...a)}catch(s){}try{console.log("[toast]",...a)}catch(s){}},y=window.currentUserId,wt=()=>window.token,q=(a,s)=>{try{if(typeof window.errorMessage=="function")return window.errorMessage(a,s)}catch(e){}try{return a&&a.data&&a.data.detail?a.data.detail:(a==null?void 0:a.message)||s||"Error"}catch(e){return s||"Error"}},nt=new Map;let ft=new Map;function yt(){try{if(!("Notification"in window))return!1;if(Notification.permission==="granted")return!0;if(Notification.permission==="denied")return!1;Notification.requestPermission().catch(()=>{})}catch(a){}return!1}function bt(){try{const a=localStorage.getItem("notified_meetups"),s=JSON.parse(a||"[]");if(Array.isArray(s))return new Set(s.map(e=>String(e)))}catch(a){}return new Set}function St(a){try{localStorage.setItem("notified_meetups",JSON.stringify(Array.from(a)))}catch(s){}}function G(a,s,e,o){if(s&&"Notification"in window&&Notification.permission==="granted"&&!a.has(s)){try{const i=new Notification(e,{body:o});i.onclick=()=>{try{i.close()}catch(n){}try{window&&window.location&&(/\/dashboard\.html$/i.test(window.location.pathname)?window.focus():window.location.href="/dashboard.html")}catch(n){}}}catch(i){}a.add(s)}}function tt(a,s){const e=String(a);let o=nt.get(e);o||(o=new Map,nt.set(e,o)),o.set(s,Date.now())}function at(a,s,e=15e3){const o=String(a),i=nt.get(o);if(!i)return!1;const n=i.get(s);return n?Date.now()-n<=e?!0:(i.delete(s),i.size||nt.delete(o),!1):!1}function Tt(a){try{const s=Array.isArray(a)?a:[],e=bt(),o=new Map;for(const i of s){const n=String(i.meetup_id),d=ft.get(n)||{};o.set(n,{status:i.status,proposed_dt_utc:i.proposed_dt_utc,confirmed_dt_utc:i.confirmed_dt_utc,proposer_user_id:i.proposer_user_id,confirmer_user_id:i.confirmer_user_id});const t=i.other_display_name?i.other_display_name:`user ${i.other_user_id}`,r=rt(i.proposed_dt_utc),c=rt(i.confirmed_dt_utc);if(!d||!d.status){i.status==="proposed"&&i.proposer_user_id!==y&&G(e,`${n}:proposed`,"Meetup proposed \u2014 needs your confirmation",t&&r?`${t} proposed ${r}`:"A meetup has been proposed.");continue}d.status!==i.status&&(i.status==="proposed"&&d.status==="confirmed"&&i.proposer_user_id!==y&&!at(n,"unconfirm")&&G(e,`${n}:unconfirmed:${i.confirmed_dt_utc||""}`,"Meetup unconfirmed",t?`${t} unconfirmed your meetup.`:"Your meetup was unconfirmed. Check the dashboard for details."),i.status==="confirmed"&&i.confirmer_user_id!==y&&!at(n,"confirm")&&G(e,`${n}:confirmed:${i.confirmed_dt_utc||""}`,"Meetup confirmed",c&&t?`${t} confirmed ${c}`:"Your meetup is confirmed."),i.status==="canceled"&&i.confirmer_user_id!==y&&i.proposer_user_id!==y&&!at(n,"cancel")&&G(e,`${n}:canceled:${i.confirmed_dt_utc||i.proposed_dt_utc||""}`,"Meetup canceled",t?`${t} canceled your meetup.`:"A meetup was canceled."));const g=d.confirmed_dt_utc||null,_=d.proposed_dt_utc||null;g!==i.confirmed_dt_utc&&i.confirmed_dt_utc&&i.confirmer_user_id!==y&&G(e,`${n}:confirmed:${i.confirmed_dt_utc}`,"Meetup confirmed",c&&t?`${t} confirmed ${c}`:"Your meetup is confirmed."),_!==i.proposed_dt_utc&&i.status==="proposed"&&i.proposer_user_id!==y&&!at(n,"propose")&&G(e,`${n}:proposed:${i.proposed_dt_utc||Date.now()}`,"Meetup proposal updated",t&&r?`${t} proposed ${r}`:"A meetup has been proposed.")}ft=o,St(e)}catch(s){}}const D={limit:100,offset:0,total:0,hasMore:!1,filters:{min_score:0,lookahead_days:14,max_overlaps:5}},X=new Map,ct=(a,s)=>{const e=Number(a)||0,o=Number(s)||0;return e<o?`pair:${e}:${o}`:`pair:${o}:${e}`},Ut=()=>{const a=document.getElementById("matchesPager");if(!a)return;const{limit:s,offset:e,total:o,hasMore:i}=D,n=Math.floor(e/s)+1,d=o?Math.ceil(o/s):n,t=e<=0,r=!i;a.innerHTML=`
      <div class="pager">
        <button class="button secondary pager-prev" ${t?"disabled":""} data-i18n="dashboard.prev">Previous</button>
        <span class="pager-status">Page ${n}${d?` / ${d}`:""}</span>
        <button class="button secondary pager-next" ${r?"disabled":""} data-i18n="dashboard.next">Next</button>
      </div>
    `;try{window.SimpleI18n&&typeof window.SimpleI18n.updateUI=="function"&&window.SimpleI18n.updateUI()}catch(c){}},W=async({useOffset:a}={})=>{const s=y;if(!s){console.warn("No user ID available for match finding");return}typeof a=="number"&&(D.offset=Math.max(0,a));const e={user_id:s,limit:D.limit,offset:D.offset,...D.filters},{data:o,response:i}=await b("/api/match/find",{method:"POST",body:e,auth:!0,returnResponse:!0}),n=i.headers.get("X-Total-Count"),d=i.headers.get("X-Has-More");D.total=n?parseInt(n,10)||0:Array.isArray(o)?o.length:0,D.hasMore=d?d.toLowerCase()==="true":!1;const r=(()=>{try{if(window.SimpleI18n&&typeof window.SimpleI18n.currentLang=="string"){const u=window.SimpleI18n.currentLang.trim();if(u)return u.toLowerCase()}}catch(u){}try{const u=localStorage.getItem("selectedLanguage");if(u)return u.trim().toLowerCase()}catch(u){}try{const u=(navigator==null?void 0:navigator.language)||(navigator==null?void 0:navigator.userLanguage);if(u)return String(u).split("-")[0].toLowerCase()}catch(u){}return"en"})(),c=u=>{var l;if(!u)return"";const m=String(u).toLowerCase();try{const p=(l=window.SimpleI18n)==null?void 0:l.languages;if(p&&p[m])return p[m]}catch(p){}return m.toUpperCase()},g=(u=[])=>Array.isArray(u)?u.filter(Boolean).map(m=>c(m)).join(", "):"",_=document.getElementById("matches");if(_){let u="";const m=Array.isArray(o)?o:[];for(const l of m){const p=l.other_display_name&&String(l.other_display_name).trim()?String(l.other_display_name).trim():`user ${l.user_id}`,v=l.match_id!==null&&typeof l.match_id!="undefined"?`match:${l.match_id}`:null;let f=v?X.get(v):void 0;!f&&y!=null&&(f=X.get(ct(y,l.user_id)));const R=f&&f.status?String(f.status).toLowerCase():null,I=!!(f&&R&&R!=="canceled"),U=R==="confirmed"?"success":"info",P=R==="confirmed"?"Meetup confirmed":"Meetup proposed",F=f?f.confirmed_dt_utc||f.proposed_dt_utc:null,H=F?rt(F):"";let T="";if(Array.isArray(l.overlaps)&&l.overlaps.length)for(const h of l.overlaps){const O=h.a_tz||null,V=h.b_tz||null,dt=String(h.start_dt_utc),gt=`${h.start_dt_utc} \u2192 ${h.end_dt_utc} (UTC)`,lt=mt(h.start_dt_utc,h.end_dt_utc),Dt=h.a_local_start&&h.a_local_end&&h.a_tz?`
                <div class="chip-col">
                  <div class="meta">you${O?" ("+O+(k(O,h.start_dt_utc)?" ("+k(O,h.start_dt_utc)+")":"")+")":""}</div>
                  <div class="meta">${Y(h.a_local_start)}</div>
                  <div class="meta">${J(h.a_local_start)}</div>
                  <div class="meta">${lt}</div>
                </div>
              `:"",Ct=h.b_local_start&&h.b_local_end&&h.b_tz?`
                <div class="chip-col">
                  <div class="meta">${p.trim()||`user ${l.user_id}`}${V?" ("+V+(k(V,h.start_dt_utc)?" ("+k(V,h.start_dt_utc)+")":"")+")":""}</div>
                  <div class="meta">${Y(h.b_local_start)}</div>
                  <div class="meta">${J(h.b_local_start)}</div>
                  <div class="meta">${lt}</div>
                </div>
              `:"",At=I?"":`
                <div class="item-actions">
                  <button class="button btn-meet-from-overlap" data-cand="${l.user_id}" data-start="${dt}" data-i18n="dashboard.propose_time">Propose time</button>
                </div>
            `;T+=`
              <div class="chip">
                <div class="chip-grid">
                  <div class="chip-col">
                    <div class="meta">UTC</div>
                    <div class="meta">${Y(h.start_dt_utc)}</div>
                    <div class="meta">${J(h.start_dt_utc)}</div>
                    <div class="meta">${lt}</div>
                  </div>
                  ${Dt}
                  ${Ct}
                </div>
                ${At}
              </div>`}const C=`${p}`,x=`<span class="badge">score ${l.score}</span>`;let B="";try{if(Array.isArray(l.shared_languages)&&l.shared_languages.length){const h=l.shared_languages[0],O=window.SimpleI18n;B=`<span class='badge'>${O&&O.languages&&O.languages[h]?O.languages[h]:h}</span>`}}catch(h){}const E="",M=l.comment?String(l.comment).replace(/</g,"&lt;"):"",N=l.comment_lang?String(l.comment_lang).toLowerCase():null,$=(Array.isArray(l.available_comment_langs)?l.available_comment_langs:[]).map(h=>String(h).toLowerCase());let L="";if(N){const h=r&&N===r?"badge success":"badge secondary",O=$.filter(gt=>gt!==N),V=r&&N!==r?`<span class="meta muted">${c(r)} preferred</span>`:"",dt=O.length?`<span class="meta muted">${g(O)}</span>`:"";L=`
            <div class="item-sub comment-lang-meta">
              <span class="${h}">${c(N)}</span>
              ${V}
              ${dt}
            </div>
          `}else $.length&&(L=`
            <div class="item-sub comment-lang-meta muted">
              ${g($)}
            </div>
          `);let Z="";M?Z=`
            <div class="chips">
              <div class="chip">
                <div class="item-sub">\u201C${M}\u201D</div>
                ${L||""}
              </div>
            </div>
          `:L&&(Z=`
            <div class="chips">
              <div class="chip">
                ${L}
              </div>
            </div>
          `);const et=I?`
          <div class="chips">
            <div class="chip">
              <div class="item-sub">
                <span class="badge ${U}">${P}</span>
                ${H?`<span class="meta muted">${H}</span>`:""}
              </div>
            </div>
          </div>
        `:"",j=r||"en",ht=window.SimpleI18n&&typeof window.SimpleI18n.t=="function"?window.SimpleI18n.t("dashboard.generate_ai_comment"):"Generate AI comment";let _t=ht;l.comment&&j&&(_t=`${ht} (${c(j)})`);const It=!l.comment||l.has_other_comment_langs,Mt=l.match_id?` data-match-id="${l.match_id}"`:"",Lt=It?`<div class="item-actions center"><button class="button secondary btn-annotate-match" data-cand="${l.user_id}" data-lang="${j}"${Mt}>${_t}</button></div>`:"";u+=`
          <li class="item-card">
            <div class="item-head">
              <div class="item-title">${C}</div>
              <div style="display:flex; gap:8px; align-items:center;">${B}${x}</div>
            </div>
            ${T?`<div class="chips">${T}</div>`:""}
            ${et}
            ${Z}
            ${Lt}
          </li>`}_.innerHTML=`<ul class="list">${u}</ul>`;try{window.SimpleI18n&&typeof window.SimpleI18n.updateUI=="function"&&window.SimpleI18n.updateUI()}catch(l){}u||(_.innerHTML='<div class="muted">No overlapping slots found. Add availability or try again later.</div>')}else{let m=`[${new Date().toISOString()}] match.find:`;m+="<ul>";for(const p of o){const v=p.other_display_name?p.other_display_name:`user ${p.user_id}`;if(m+=`<li>${v} \u2014 score ${p.score}`,p.comment?m+=`<br/><small>AI comment:</small> ${p.comment}`:m+=` <button class="btn-annotate-match" data-cand="${p.user_id}" title="Generate a short AI summary for this match">Generate AI comment</button>`,Array.isArray(p.overlaps)&&p.overlaps.length){m+="<br/><small>overlaps:</small><ul>";for(const f of p.overlaps){const R=`${f.start_dt_utc} \u2192 ${f.end_dt_utc} (UTC)`,I=f.a_local_start&&f.a_local_end&&f.a_tz?` | you: ${f.a_local_start} \u2192 ${f.a_local_end} (${f.a_tz})`:"",U=f.b_local_start&&f.b_local_end&&f.b_tz?` | ${v}: ${f.b_local_start} \u2192 ${f.b_local_end} (${f.b_tz})`:"",P=String(f.start_dt_utc);m+=`<li>${R}${I}${U} <button class="btn-meet-from-overlap" data-cand="${p.user_id}" data-start="${P}">Meet here</button></li>`}m+="</ul>"}m+="</li>"}m+="</ul><br/>";const l=document.getElementById("out");l&&(l.innerHTML=m+l.innerHTML)}},K=async()=>{try{const a=await b("/api/meetup/list",{auth:!0}),s=document.getElementById("meetups");if(s){const e=new Date;X.clear();const o=(a||[]).filter(n=>{const d=String(n.status||"").toLowerCase()==="proposed",t=n.proposed_dt_utc?new Date(n.proposed_dt_utc):null,r=n.confirmed_dt_utc?new Date(n.confirmed_dt_utc):null,c=t&&t.getTime()>=e.getTime(),g=r&&r.getTime()>=e.getTime();return d||c||g}).sort((n,d)=>{const t=new Date(n.confirmed_dt_utc||n.proposed_dt_utc||0).getTime(),r=new Date(d.confirmed_dt_utc||d.proposed_dt_utc||0).getTime();return t-r});for(const n of o)n&&typeof n=="object"&&(n.match_id!==null&&typeof n.match_id!="undefined"&&X.set(`match:${n.match_id}`,n),y!=null&&n.other_user_id!=null&&X.set(ct(y,n.other_user_id),n));let i="";for(const n of o){const d=`Meetup #${n.meetup_id}`,t=n.other_display_name&&String(n.other_display_name).trim()?String(n.other_display_name).trim():`user ${n.other_user_id}`,r=`Match #${n.match_id} \u2022 with ${t}`,c=`<span class="badge ${n.status==="confirmed"?"success":n.status==="canceled"?"error":"info"}">${n.status}</span>`,g=(T,C,x)=>{if(!C)return"";const B=Y(C),E=J(C),M=new Date(C),N=`${M.getFullYear()}-${String(M.getMonth()+1).padStart(2,"0")}-${String(M.getDate()).padStart(2,"0")}`,A=`${String(M.getHours()).padStart(2,"0")}:${String(M.getMinutes()).padStart(2,"0")}`;let $=window.liveTz||null;if(!$)try{$=localStorage.getItem("live_tz")}catch(Z){}if(!$)try{$=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(Z){}$||($="UTC");const L=k($,C);return`
              <div class="chip">
                ${T!=="Proposed"?`<div class="meta" style="font-weight:700;">${T}</div>`:""}
                ${x?`<div class="meta">${x}</div>`:""}
                <div class="chip-grid">
                  <div class="chip-col">
                    <div class="meta">UTC</div>
                    <div class="meta">${B}</div>
                    <div class="meta">${E}</div>
                  </div>
                  <div class="chip-col">
                    <div class="meta tz-inline">${$}${L?" ("+L+")":""}</div>
                    <div class="meta">${N}</div>
                    <div class="meta">${A}</div>
                  </div>
                </div>
              </div>`},_=g("Proposed",n.proposed_dt_utc),u=g("Confirmed",n.confirmed_dt_utc),m="",l="",p=n.status==="confirmed"&&n.jitsi_url?`<a class="button" href="${String(n.jitsi_url).replace(/\"/g,"&quot;")}" target="_blank" rel="noopener noreferrer">Join</a>`:"",f=n.status==="proposed"&&n.proposed_dt_utc&&n.proposer_user_id!==y?`<button class="button btn-confirm-meetup" data-id="${n.meetup_id}" data-dt="${n.proposed_dt_utc}">Confirm</button>`:"",I=n.status==="confirmed"&&n.confirmer_user_id===y?`<button class="button secondary btn-unconfirm-meetup" data-id="${n.meetup_id}">Unconfirm</button>`:"",U=`<button class="button danger btn-delete-meetup" data-id="${n.meetup_id}">Delete</button>`,F=!n.proposed_dt_utc?`<button class="button secondary btn-meet-propose" data-id="${n.meetup_id}">Propose meetup</button>`:"",H=`<div style="display:flex; gap:8px; align-items:center;">${c} ${p} ${U}</div>`;i+=`
            <li class="item-card">
              <div class="item-head">
                <div class="item-title">${r}</div>
                ${H}
              </div>
              <div class="chips">
                ${_}
                ${u}
              </div>
              ${m}
              ${l}
              <div class="item-actions">${f} ${I} ${F}</div>
            </li>`}s.innerHTML=`<ul class="list">${i}</ul>`;try{window.__meetupIdLookup=X}catch(n){}try{yt()&&Tt(o)}catch(n){}}else{let o=`[${new Date().toISOString()}] meetup.list:`;o+="<ul>";for(const n of a){const d=`#${n.meetup_id} (match ${n.match_id}) other_user=${n.other_user_id} status=${n.status}`;if(o+=`<li>${d}`,n.status==="confirmed"&&n.jitsi_url){const t=String(n.jitsi_url).replace(/"/g,"&quot;");o+=` \u2014 <a href="${t}" target="_blank" rel="noopener noreferrer">Join</a>`}o+="</li>"}o+="</ul><br/>";const i=document.getElementById("out");i&&(i.innerHTML=o+i.innerHTML)}}catch(a){S("meetup.list:ERROR",a)}};async function st(){try{const a=await b("/api/availability",{auth:!0}),s=document.getElementById("availList");if(s){const e=a.map(o=>{const i=mt(o.start_dt_utc,o.end_dt_utc);let n,d,t,r;if(o.start_dt_local&&o.timezone){n=Y(o.start_dt_local),d=J(o.start_dt_local);let _=o.timezone;Q(_)||(_=window.liveTz||localStorage.getItem("live_tz")||Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"),t=_,r=Q(_)?k(_,o.start_dt_utc):""}else{const _=new Date(o.start_dt_utc);let u=window.liveTz||localStorage.getItem("live_tz")||Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";Q(u)||(u="UTC");const m=new Date(_.toLocaleString("en-US",{timeZone:u}));n=`${m.getFullYear()}-${z(m.getMonth()+1)}-${z(m.getDate())}`,d=`${z(m.getHours())}:${z(m.getMinutes())}`,t=u,r=Q(u)?k(u,o.start_dt_utc):""}const c=Y(o.start_dt_utc),g=J(o.start_dt_utc);return`
            <li class="item-card">
              <div class="item-head">
                <div class="item-title">Slot #${o.id}</div>
                <div class="item-actions">
                  <button class="button secondary btn-edit-slot"
                    data-id="${o.id}"
                    data-start="${o.start_dt_utc}"
                    data-end="${o.end_dt_utc}"
                    data-local-date="${n}"
                    data-local-hour="${d.slice(0,2)}"
                    data-tz="${Q(t)?t:"UTC"}" data-i18n="dashboard.slot_edit">Edit</button>
                  <button class="button secondary btn-delete-slot" data-id="${o.id}" data-i18n="dashboard.slot_delete">Delete</button>
                </div>
              </div>
              <div class="chips">
                <div class="chip">
                  <div class="chip-grid">
                    <div class="chip-col">
                      <div class="meta">UTC</div>
                      <div class="time">${c}</div>
                      <div class="time">${g}</div>
                      <div class="duration">${i}</div>
                    </div>
                    <div class="chip-col">
                      <div class="meta tz-inline">${t}${r?" ("+r+")":""}</div>
                      <div class="time">${n}</div>
                      <div class="time">${d}</div>
                      <div class="duration">${i}</div>
                    </div>
                  </div>
                  
                  <div class="edit-row" style="display:none; margin-top:8px;">
                    <div class="avail-grid">
                      <div class="avail-group">
                        <input type="date" class="edit-start-date" />
                        <select class="edit-start-hour" title="Start hour (0\u201323)"></select>
                        <select class="edit-duration-hours" title="Duration (hours)">
                          <option value="1">1 hour</option>
                          <option value="2">2 hours</option>
                          <option value="3">3 hours</option>
                        </select>
                      </div>
                    </div>
                    <div class="item-actions" style="margin-top:8px;">
                      <button class="button btn-save-slot" data-id="${o.id}">Save</button>
                      <button class="button secondary btn-cancel-edit">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            </li>`}).join("");s.innerHTML=`<ul class="list">${e}</ul>`;try{window.SimpleI18n&&typeof window.SimpleI18n.updateUI=="function"&&window.SimpleI18n.updateUI()}catch(o){}}else{let o=`[${new Date().toISOString()}] availability.list:`;o+="<ul>";for(const n of a)o+=`<li>#${n.id} ${n.start_dt_utc} \u2192 ${n.end_dt_utc}</li>`;o+="</ul><br/>";const i=document.getElementById("out");i&&(i.innerHTML=o+i.innerHTML)}}catch(a){S("availability.list:ERROR",a)}}window.fetchAndRenderMatches=W,window.fetchAvailList=st,document.addEventListener("DOMContentLoaded",()=>{var s;const a=window.bindClick;try{it()}catch(e){}try{window.addEventListener("storage",e=>{e&&e.key==="live_tz"&&it()})}catch(e){}a("btn-avail-list",st);try{(s=document.getElementById("btn-meet-list"))==null||s.remove()}catch(e){}a("btn-match-create",async()=>{try{const e=parseInt(ot("createA").value,10),o=parseInt(ot("createB").value,10),i=await b("/api/match/create",{method:"POST",body:{a_user_id:e,b_user_id:o},auth:!0});S("match.create",i);try{setInterval(()=>{K().catch(()=>{})},12e5)}catch(n){}}catch(e){S("match.create:ERROR",e)}}),a("btn-meet-propose",async()=>{var e;try{const o=parseInt(ot("meetMatchId").value,10),i=await b("/api/meetup/propose",{method:"POST",body:{match_id:o},auth:!0});S("meetup.propose",i);try{await((e=document.getElementById("btn-meet-list"))==null?void 0:e.click())}catch(n){}w("Meetup proposed")}catch(o){S("meetup.propose:ERROR",o)}}),a("btn-meet-list",async()=>{try{const e=await b("/api/meetup/list",{auth:!0}),o=document.getElementById("meetups");if(o){const i=new Date,n=(e||[]).filter(t=>{const r=t.proposed_dt_utc?new Date(t.proposed_dt_utc):null,c=t.confirmed_dt_utc?new Date(t.confirmed_dt_utc):null,g=r&&r.getTime()>=i.getTime(),_=c&&c.getTime()>=i.getTime();return g||_}).sort((t,r)=>{const c=new Date(t.confirmed_dt_utc||t.proposed_dt_utc||0).getTime(),g=new Date(r.confirmed_dt_utc||r.proposed_dt_utc||0).getTime();return c-g});let d="";for(const t of n){const r=`Meetup #${t.meetup_id}`,c=t.other_display_name?t.other_display_name:`user ${t.other_user_id}`,g=`Match #${t.match_id} \u2022 with ${c}`,_=`<span class="badge ${t.status==="confirmed"?"success":t.status==="canceled"?"error":"info"}">${t.status}</span>`,u=(H,T,C)=>{if(!T)return"";const x=Y(T),B=J(T),E=new Date(T),M=`${E.getFullYear()}-${z(E.getMonth()+1)}-${z(E.getDate())}`,N=`${z(E.getHours())}:${z(E.getMinutes())}`;let A=window.liveTz||null;if(!A)try{A=localStorage.getItem("live_tz")}catch(L){}if(!A)try{A=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(L){}A||(A="UTC");const $=k(A,T);return`
                <div class="chip">
                  ${H!=="Proposed"?`<div class="meta" style="font-weight:700;">${H}</div>`:""}
                  ${C?`<div class="meta">${C}</div>`:""}
                  <div class="chip-grid">
                    <div class="chip-col">
                      <div class="meta">UTC</div>
                      <div class="meta">${x}</div>
                      <div class="meta">${B}</div>
                    </div>
                    <div class="chip-col">
                      <div class="meta tz-inline">${A}${$?" ("+$+")":""}</div>
                      <div class="meta">${M}</div>
                      <div class="meta">${N}</div>
                    </div>
                  </div>
                </div>`},m=u("Proposed",t.proposed_dt_utc),l=u("Confirmed",t.confirmed_dt_utc),p="",v="",f=t.status==="confirmed"&&t.jitsi_url?`<a class="button" href="${String(t.jitsi_url).replace(/\"/g,"&quot;")}" target="_blank" rel="noopener noreferrer">Join</a>`:"",I=t.status==="proposed"&&t.proposed_dt_utc&&t.proposer_user_id!==y?`<button class="button btn-confirm-meetup" data-id="${t.meetup_id}" data-dt="${t.proposed_dt_utc}">Confirm</button>`:"",P=t.status==="confirmed"&&t.confirmer_user_id===y?`<button class="button secondary btn-unconfirm-meetup" data-id="${t.meetup_id}">Unconfirm</button>`:"",F=`<button class="button danger btn-delete-meetup" data-id="${t.meetup_id}">Delete</button>`;d+=`
              <li class="item-card">
                <div class="item-head">
                  <div class="item-title">${g}</div>
                  <div style="display:flex; gap:8px; align-items:center;">${_} ${f} ${F}</div>
                </div>
                <div class="chips">
                  ${m}
                  ${l}
                </div>
                ${p}
                ${v}
                <div class="item-actions">${I} ${P}</div>
              </li>`}o.innerHTML=`<ul class="list">${d}</ul>`}else{let n=`[${new Date().toISOString()}] meetup.list:`;n+="<ul>";for(const t of e){const r=`#${t.meetup_id} (match ${t.match_id}) other_user=${t.other_user_id} status=${t.status}`;if(n+=`<li>${r}`,t.status==="confirmed"&&t.jitsi_url){const c=String(t.jitsi_url).replace(/"/g,"&quot;");n+=` \u2014 <a href="${c}" target="_blank" rel="noopener noreferrer">Join</a>`}n+="</li>"}n+="</ul><br/>";const d=document.getElementById("out");d&&(d.innerHTML=n+d.innerHTML)}}catch(e){S("meetup.list:ERROR",e)}}),document.addEventListener("click",async e=>{var d;try{const t=e.target&&typeof e.target.closest=="function"?e.target.closest("a"):null;if(t&&t.href&&(t.href.includes("jitsi")||t.target==="_blank"||!t.href.startsWith(window.location.origin)))return}catch(t){}if(e.target.classList.contains("btn-unconfirm-meetup")){const t=parseInt(e.target.dataset.id,10);if(!window.confirm("Unconfirm this meetup? The time will return to proposed status."))return;try{await b("/api/meetup/unconfirm",{method:"POST",body:{meetup_id:t},auth:!0}),w("Meetup unconfirmed"),tt(t,"unconfirm"),await K()}catch(c){w(q(c,"Failed to unconfirm meetup"),"error"),S("meetup.unconfirm:ERROR",c)}return}if(e.target.classList.contains("btn-cancel-meetup")){const t=parseInt(e.target.dataset.id,10);if(!window.confirm("Cancel this meetup for both participants?"))return;try{await b("/api/meetup/cancel",{method:"POST",body:{meetup_id:t},auth:!0}),w("Meetup canceled"),tt(t,"cancel"),await K()}catch(c){w(q(c,"Failed to cancel meetup"),"error"),S("meetup.cancel:ERROR",c)}return}if(e.target.classList.contains("btn-delete-meetup")){const t=parseInt(e.target.dataset.id,10);try{await b(`/api/meetup/${t}`,{method:"DELETE",auth:!0}),w("Meetup deleted"),tt(t,"delete");try{window.fetchAndRenderMeetups&&await window.fetchAndRenderMeetups()}catch(r){}}catch(r){w(q(r,"Failed to delete meetup"),"error"),S("meetup.delete:ERROR",r)}}if(e.target.classList.contains("btn-confirm-meetup")){const t=parseInt(e.target.dataset.id,10),r=e.target.dataset.dt;try{await b("/api/meetup/confirm",{method:"POST",body:{meetup_id:t,confirmed_dt_utc:r},auth:!0}),w("Meetup confirmed"),tt(t,"confirm"),await K()}catch(c){w(q(c,"Failed to confirm meetup"),"error"),S("meetup.confirm:ERROR",c)}}if(e.target.classList.contains("btn-delete-slot")){const t=e.target.dataset.id;try{await b(`/api/availability/${t}`,{method:"DELETE",auth:!0}),w("Slot deleted");try{window.fetchAvailList&&await window.fetchAvailList()}catch(r){}try{window.fetchAndRenderMatches&&await window.fetchAndRenderMatches()}catch(r){}}catch(r){w(q(r,"Failed to delete slot"),"error"),S("availability.delete:ERROR",r)}}if(e.target&&typeof e.target.closest=="function"&&e.target.closest(".btn-edit-slot")){const t=e.target.closest(".btn-edit-slot"),r=t.closest(".item-card");if(!r)return;const c=r.querySelector(".edit-row");if(!c)return;const g=t.dataset.start,_=t.dataset.end,u=new Date(g),m=new Date(_),l=c.querySelector(".edit-start-date"),p=c.querySelector(".edit-start-hour");try{pt(p)}catch(I){}const v=c.querySelector(".edit-duration-hours");pt(p);const f=t.dataset.localDate,R=t.dataset.localHour;if(l&&f?l.value=f:l&&u instanceof Date&&!isNaN(u.getTime())&&(l.value=`${u.getFullYear()}-${z(u.getMonth()+1)}-${z(u.getDate())}`),p&&R?p.value=String(parseInt(R,10)):p&&u instanceof Date&&!isNaN(u.getTime())&&(p.value=String(u.getHours())),v&&u instanceof Date&&m instanceof Date&&!isNaN(u.getTime())&&!isNaN(m.getTime())){const I=Math.max(1,Math.round((m.getTime()-u.getTime())/36e5));v.value=String(Math.max(1,Math.min(3,I)))}c.style.display="block"}if(e.target.classList.contains("btn-cancel-edit")){const t=e.target.closest(".edit-row");t&&(t.style.display="none")}if(e.target.classList.contains("btn-save-slot")){const t=e.target,r=t.dataset.id,c=t.closest(".edit-row");if(!c)return;const g=c.querySelector(".edit-start-date"),_=c.querySelector(".edit-start-hour"),u=c.querySelector(".edit-duration-hours"),m=g?g.value:null,l=_?_.value:null,p=u?parseInt(u.value||"1",10):1;try{let U=function($){return String($).padStart(2,"0")},P=function($,L,Z,et){return`${$}-${U(L)}-${U(Z)}T${U(et)}:00:00`},F=function($,L,Z,et){const j=new Date(Date.UTC($,L-1,Z,12,0,0));return j.setUTCDate(j.getUTCDate()+et),{y:j.getUTCFullYear(),m:j.getUTCMonth()+1,d:j.getUTCDate()}};var o=U,i=P,n=F;let v=t.dataset.tz||(typeof window!="undefined"&&window.liveTz?window.liveTz:null);if(!v)try{v=localStorage.getItem("live_tz")}catch($){}if(!v)try{v=Intl.DateTimeFormat().resolvedOptions().timeZone}catch($){}v||(v="UTC");const f=vt(m,l,v);if(!f||isNaN(p)){w("Please provide valid date, start hour and duration","error");return}const I=new Date(new Date(f).getTime()+p*3600*1e3).toISOString().replace(/\.\d{3}Z$/,"Z");if(new Date(I)<=new Date(f)){w("End must be after start","error");return}const[H,T,C]=m.split("-").map(Number);let x=parseInt(l,10)+p,B=H,E=T,M=C;for(;x>=24;)x-=24,{y:B,m:E,d:M}=F(B,E,M,1);const N=P(H,T,C,parseInt(l,10)),A=P(B,E,M,x);await b(`/api/availability/${r}`,{method:"PATCH",auth:!0,body:{start_dt_utc:f,end_dt_utc:I,start_dt_local:N,end_dt_local:A,timezone:v}}),w("Slot updated"),c.style.display="none";try{window.fetchAvailList&&await window.fetchAvailList()}catch($){}try{window.fetchAndRenderMatches&&await window.fetchAndRenderMatches()}catch($){}}catch(v){w(q(v,"Failed to update slot"),"error"),S("availability.patch:ERROR",v)}}if(e.target.classList.contains("btn-meet-from-overlap")){const t=e.target,r=parseInt(t.dataset.cand,10),c=t.dataset.start,g=t.textContent;t.disabled=!0,t.textContent="Proposing\u2026";try{const _=await b("/api/match/create",{method:"POST",auth:!0,body:{a_user_id:y,b_user_id:r}}),{meetup_id:u}=await b("/api/meetup/propose",{method:"POST",auth:!0,body:{match_id:_.match_id,proposed_dt_utc:c}});w("Meetup proposed");const m=window.__meetupIdLookup?window.__meetupIdLookup.get(`match:${_.match_id}`)||window.__meetupIdLookup.get(ct(y,r)):null,l=u||(m?m.meetup_id:null)||_.meetup_id||"pending";tt(l,"propose");const p=t.closest(".item-actions");p&&(p.innerHTML='<span class="badge info">Proposed \u2014 awaiting confirm</span>');try{window.fetchAndRenderMeetups&&await window.fetchAndRenderMeetups()}catch(v){}try{window.fetchAndRenderMatches&&await window.fetchAndRenderMatches()}catch(v){}}catch(_){t.disabled=!1,t.textContent=g||"Propose this time",w(q(_,"Failed to propose meetup"),"error"),S("meetup.propose:ERROR",_)}}if(e.target.classList.contains("btn-annotate-match")){const t=parseInt(e.target.dataset.cand,10),r=e.target.dataset.lang||((d=window.SimpleI18n)==null?void 0:d.currentLang)||"en";try{const c=await b("/api/match/create",{method:"POST",auth:!0,body:{a_user_id:y,b_user_id:t}});await b("/api/match/annotate",{method:"POST",auth:!0,body:{match_id:c.match_id,lang:r}}),w("AI comment generated"),await W()}catch(c){w(q(c,"Failed to generate comment"),"error"),S("match.annotate:ERROR",c)}}});try{if(wt()){try{it()}catch(e){}try{st()}catch(e){}setTimeout(()=>{try{W()}catch(e){}},100);try{K()}catch(e){}}}catch(e){}}),document.addEventListener("click",async a=>{const s=a.target&&a.target.classList&&a.target.classList.contains("pager-prev"),e=a.target&&a.target.classList&&a.target.classList.contains("pager-next");if(!(!s&&!e)){if(a.preventDefault(),s&&D.offset>0){const o=Math.max(0,D.offset-D.limit);await W({useOffset:o})}if(e&&D.hasMore){const o=D.offset+D.limit;await W({useOffset:o})}}});try{window.fetchAvailList=st}catch(a){}try{window.fetchAndRenderMatches=W}catch(a){}try{window.fetchAndRenderMeetups=K}catch(a){}})();
