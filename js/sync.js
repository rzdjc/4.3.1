/* Cloud sync layer: Supabase Auth + per-user data sync. Optional — the app works fully offline without signing in. */
(function(){
const SUPABASE_URL='https://jialkqkcykrmopfdnerq.supabase.co';
const SUPABASE_KEY='sb_publishable__gDqaaqo4JWVsxPCz9TNBg_fftwwXWY';
const META_KEY='gymTrackerSyncMeta';
if(!window.supabase){console.warn('Supabase client not loaded; sync disabled');return}
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null,syncStatus='signed-out',pushTimer=null;

function meta(){return JSON.parse(localStorage.getItem(META_KEY)||'{}')}
function setMeta(m){localStorage.setItem(META_KEY,JSON.stringify({...meta(),...m}))}
function refreshAccountUI(){if(document.querySelector('.view.active')?.id==='settings')renderAccountCard()}

async function pushRemote(){
 if(!currentUser)return;
 syncStatus='syncing';refreshAccountUI();
 const now=new Date().toISOString();
 const{error}=await sb.from('user_data').upsert({user_id:currentUser.id,data:S,updated_at:now});
 if(error){syncStatus='error';console.error('Sync push failed',error)}
 else{syncStatus='synced';setMeta({lastPushedAt:now})}
 refreshAccountUI();
}
function debouncedPush(){if(!currentUser)return;clearTimeout(pushTimer);pushTimer=setTimeout(pushRemote,1500)}
window.onDataChanged=debouncedPush;

async function pullIfNewer(){
 if(!currentUser)return;
 syncStatus='syncing';refreshAccountUI();
 const{data,error}=await sb.from('user_data').select('data,updated_at').eq('user_id',currentUser.id).maybeSingle();
 if(error){syncStatus='error';refreshAccountUI();return}
 if(!data){await pushRemote();return}
 const localPushedAt=meta().lastPushedAt;
 if((!localPushedAt||new Date(data.updated_at)>new Date(localPushedAt))&&data.data&&Object.keys(data.data).length){
  S=data.data;
  S.workouts=S.workouts||[];S.metrics=S.metrics||[];S.active=S.active||null;S.day=S.day??0;S.programs=S.programs||[];S.activeProgram=S.activeProgram||'builtin';S.volumeGoals=S.volumeGoals||{};
  localStorage.setItem(K,JSON.stringify(S));
  setMeta({lastPushedAt:data.updated_at});
  render(document.querySelector('.bottom-nav button.active')?.dataset.v||'workout');
  toast('Synced from your account ✓');
 }
 syncStatus='synced';refreshAccountUI();
}

async function signUp(email,password){
 const{data,error}=await sb.auth.signUp({email,password});
 if(error)return toast(error.message);
 toast(data.session?'Account created ✓':'Check your email to confirm your account');
 if(data.session)closeAuthModal();
}
async function signIn(email,password){
 const{error}=await sb.auth.signInWithPassword({email,password});
 if(error)return toast(error.message);
 toast('Signed in ✓');
 closeAuthModal();
}
async function signOut(){
 await sb.auth.signOut();
 currentUser=null;syncStatus='signed-out';
 toast('Signed out');
 refreshAccountUI();
}
function closeAuthModal(){document.getElementById('modal').classList.add('hidden')}

function openAuthModal(){
 let isSignUp=false;
 function draw(){
  document.getElementById('modalbody').innerHTML=`<div class="eyebrow">ACCOUNT</div><h2>${isSignUp?'Create your account.':'Sign in.'}</h2><p class="modal-sub">Sync your workouts across every device.</p><div class="field"><label>Email</label><input class="input" id="authEmail" type="email" inputmode="email" autocomplete="email"></div><div class="field"><label>Password</label><input class="input" id="authPassword" type="password" autocomplete="${isSignUp?'new-password':'current-password'}"></div><button class="finish-btn" id="authSubmitBtn">${isSignUp?'Create account':'Sign in'}</button><button class="ghost wide" id="authToggleBtn">${isSignUp?'Have an account? Sign in':"Don't have an account? Sign up"}</button>`;
  document.getElementById('authSubmitBtn').onclick=()=>{
   const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
   if(!email||!password)return toast('Enter email and password');
   isSignUp?signUp(email,password):signIn(email,password);
  };
  document.getElementById('authToggleBtn').onclick=()=>{isSignUp=!isSignUp;draw()};
 }
 draw();
 document.getElementById('modal').classList.remove('hidden');
}

function renderAccountCard(){
 const el=document.getElementById('accountCard');
 if(!el)return;
 if(currentUser){
  const statusText={syncing:'Syncing…',synced:'Synced ✓',error:'Sync error — will retry'}[syncStatus]||'';
  el.innerHTML=`<div class="setting-row"><div><strong>${esc(currentUser.email)}</strong><small>${statusText}</small></div><button class="secondary" id="signOutBtn">Sign out</button></div>`;
  document.getElementById('signOutBtn').onclick=signOut;
 } else {
  el.innerHTML=`<div class="setting-row"><div><strong>Sync & backup</strong><small>Sign in to save your data to the cloud and use it on other devices.</small></div><button class="secondary" id="signInBtn">Sign in</button></div>`;
  document.getElementById('signInBtn').onclick=openAuthModal;
 }
}

const originalSettings=window.settings;
window.settings=function(){
 originalSettings();
 document.getElementById('settings').insertAdjacentHTML('afterbegin','<div class="settings-card neo-settings account-card" id="accountCard"></div>');
 renderAccountCard();
};

sb.auth.onAuthStateChange((event,session)=>{
 currentUser=session?.user||null;
 if(currentUser&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'))pullIfNewer();
 if(event==='SIGNED_OUT')syncStatus='signed-out';
 refreshAccountUI();
});
})();
