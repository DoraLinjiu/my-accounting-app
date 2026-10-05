/* ===== 数据层：localStorage 持久化（v1.4） ===== */
var Store = (function () {
  'use strict';
  var KEY = 'macaron-ledger-v1';
  var VERSION = '1.5.2';
  var SCHEMA_VERSION = 2;
  var RECOVERY_PREFIX = KEY + '-recovery-';
  var ICON_TAG = 'fa-solid fa-tag', ICON_CARD = 'fa-solid fa-credit-card';
  var ALLOWED_ICONS = [
    'fa-solid fa-utensils','fa-solid fa-cart-shopping','fa-solid fa-car','fa-solid fa-gamepad','fa-solid fa-house',
    'fa-solid fa-droplet','fa-solid fa-mug-hot','fa-solid fa-bus','fa-solid fa-shirt','fa-solid fa-film','fa-solid fa-book',
    'fa-solid fa-dumbbell','fa-solid fa-plane','fa-solid fa-phone','fa-solid fa-wifi','fa-solid fa-gift','fa-solid fa-heart',
    'fa-solid fa-star','fa-solid fa-bolt','fa-solid fa-tag','fa-solid fa-credit-card','fa-solid fa-wallet','fa-solid fa-piggy-bank',
    'fa-solid fa-building-columns','fa-solid fa-landmark','fa-solid fa-money-bill-wave','fa-solid fa-chart-line','fa-solid fa-envelope',
    'fa-solid fa-briefcase','fa-brands fa-weixin','fa-brands fa-alipay','fa-solid fa-coins','fa-solid fa-paw','fa-solid fa-ellipsis'
  ];
  var EMOJI_ICON_MAP = {
    '💚':'fa-brands fa-weixin','💵':'fa-solid fa-coins','💙':'fa-brands fa-alipay','💛':'fa-solid fa-piggy-bank',
    '🏦':'fa-solid fa-building-columns','💳':ICON_CARD,'🍜':'fa-solid fa-utensils','🚌':'fa-solid fa-car',
    '🛓':'fa-solid fa-cart-shopping','🎮':'fa-solid fa-gamepad','🏠':'fa-solid fa-house','💧':'fa-solid fa-droplet',
    '💰':'fa-solid fa-money-bill-wave','🧧':'custom-red-packet','📈':'fa-solid fa-chart-line','🏷':ICON_TAG,
    '🐾':'fa-solid fa-paw','☕':'fa-solid fa-mug-hot','❤':'fa-solid fa-heart'
  };
  var DEFAULT_ACCOUNTS = [
    {id:'a-wx',name:'微信零钱',icon:'fa-brands fa-weixin',color:'#BAFFC9',balance:0,order:0,archived:false},
    {id:'a-wxt',name:'微信零钱通',icon:'fa-solid fa-coins',color:'#BAFFC9',balance:0,order:1,archived:false},
    {id:'a-zfb',name:'支付宝零钱',icon:'fa-brands fa-alipay',color:'#BAE1FF',balance:0,order:2,archived:false},
    {id:'a-yeb',name:'余额宝',icon:'fa-solid fa-piggy-bank',color:'#FFFFBA',balance:0,order:3,archived:false},
    {id:'a-icbc',name:'工商银行',icon:'fa-solid fa-building-columns',color:'#FFB3BA',balance:0,order:4,archived:false},
    {id:'a-ccb',name:'建设银行',icon:'fa-solid fa-landmark',color:'#BAE1FF',balance:0,order:5,archived:false}
  ];
  var DEFAULT_CATEGORIES = [
    {id:'c-food',name:'餐饮',icon:'fa-solid fa-utensils',color:'#FFB3BA',kind:'expense',order:0},
    {id:'c-water',name:'桶装水',icon:'fa-solid fa-droplet',color:'#BAE1FF',kind:'expense',order:1},
    {id:'c-trans',name:'交通',icon:'fa-solid fa-car',color:'#BAE1FF',kind:'expense',order:2},
    {id:'c-shop',name:'购物',icon:'fa-solid fa-cart-shopping',color:'#BAFFC9',kind:'expense',order:3},
    {id:'c-fun',name:'娱乐',icon:'fa-solid fa-gamepad',color:'#FFFFBA',kind:'expense',order:4},
    {id:'c-rent',name:'房租',icon:'fa-solid fa-house',color:'#FFB3BA',kind:'expense',order:5},
    {id:'c-other',name:'其他',icon:'fa-solid fa-ellipsis',color:'#BAE1FF',kind:'expense',order:6},
    {id:'c-salary',name:'工资',icon:'fa-solid fa-money-bill-wave',color:'#BAFFC9',kind:'income',order:7},
    {id:'c-hb',name:'红包',icon:'custom-red-packet',color:'#E75B62',kind:'income',order:8},
    {id:'c-inv',name:'理财',icon:'fa-solid fa-chart-line',color:'#BAE1FF',kind:'income',order:9},
    {id:'c-inoth',name:'其他',icon:'fa-solid fa-ellipsis',color:'#FFFFBA',kind:'income',order:10}
  ];
  var state = blank(), loadError = null;
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function blank(){return {schemaVersion:SCHEMA_VERSION,accounts:clone(DEFAULT_ACCOUNTS),categories:clone(DEFAULT_CATEGORIES),transactions:[],settings:{dark:false,nickname:'Dora'}};}
  function r2(n){return Math.round(Number(n)*100)/100;}
  function finiteNumber(v){return typeof v==='number'&&Number.isFinite(v);}
  function validId(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);}
  function validColor(v){return typeof v==='string'&&/^#[0-9A-Fa-f]{6}$/.test(v);}
  function p2(n){return(n<10?'0':'')+n;}
  function localDate(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
  function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;var d=new Date(v+'T00:00:00');return!isNaN(d.getTime())&&localDate(d)===v;}
  function safeText(v,max,fallback){var s=typeof v==='string'?v.trim():'';return(s||fallback||'').slice(0,max||2000);}
  function faIcon(raw,fallback){var v=raw==null?'':String(raw).trim();if(v==='custom-red-packet')return v;var key=v.replace(/[\uFE0E\uFE0F]/g,'');return EMOJI_ICON_MAP[key]||(ALLOWED_ICONS.indexOf(v)>=0?v:(fallback||ICON_TAG));}
  function allowedIcon(raw){var v=raw==null?'':String(raw).trim();return v==='custom-red-packet'||ALLOWED_ICONS.indexOf(v)>=0||!!EMOJI_ICON_MAP[v.replace(/[\uFE0E\uFE0F]/g,'')];}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e9).toString(36);}
  function save(){localStorage.setItem(KEY,JSON.stringify(state));return true;}
  function mutate(fn){if(loadError)throw new Error('请先到设置页处理存档错误');var before=clone(state);try{var result=fn();save();return result;}catch(e){state=before;throw e;}}
  function saveRecovery(raw,reason){var key=RECOVERY_PREFIX+Date.now();try{localStorage.setItem(key,raw);}catch(ignore){}loadError={message:reason,recoveryKey:key,raw:raw};}

  function migrate(d){
    if(!d.settings||typeof d.settings!=='object'||Array.isArray(d.settings))d.settings={dark:false,nickname:'Dora'};
    d.settings.dark=!!d.settings.dark;d.settings.nickname=safeText(d.settings.nickname,20,'Dora');
    d.accounts.forEach(function(a,i){a.archived=!!a.archived;a.icon=faIcon(a.icon,ICON_CARD);a.color=validColor(a.color)?a.color:'#BAE1FF';a.order=finiteNumber(a.order)?a.order:i;});
    ['c-water','c-other','c-inoth'].forEach(function(id){if(!d.categories.some(function(c){return c.id===id;}))d.categories.push(clone(DEFAULT_CATEGORIES.filter(function(c){return c.id===id;})[0]));});
    d.categories.forEach(function(c,i){c.icon=c.id==='c-hb'&&(c.icon==='fa-solid fa-envelope'||c.icon==='fa-solid fa-envelope-open-text')?'custom-red-packet':faIcon(c.icon,ICON_TAG);c.color=validColor(c.color)?c.color:'#BAE1FF';c.order=finiteNumber(c.order)?c.order:i;});
    var accountIds={};d.accounts.forEach(function(a){accountIds[a.id]=true;});
    d.transactions.forEach(function(t){[t.accountId,t.toAccountId].forEach(function(id){if(id&&!accountIds[id]){d.accounts.push({id:id,name:'旧版已删除账户',icon:ICON_CARD,color:'#B8B8C2',balance:0,order:d.accounts.length,archived:true,legacyPlaceholder:true});accountIds[id]=true;}});});
    var categoryIds={};d.categories.forEach(function(c){categoryIds[c.id]=true;});
    d.transactions.forEach(function(t){if(t.kind!=='transfer'&&!categoryIds[t.categoryId])t.categoryId=t.kind==='income'?'c-inoth':'c-other';});
    d.schemaVersion=SCHEMA_VERSION;return d;
  }
  function validateData(input,allowLegacy){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('根数据必须是 JSON 对象');
    if(!Array.isArray(input.accounts))throw new Error('accounts 必须是数组');
    if(!Array.isArray(input.categories))throw new Error('categories 必须是数组');
    if(!Array.isArray(input.transactions))throw new Error('transactions 必须是数组');
    if(input.settings!=null&&(typeof input.settings!=='object'||Array.isArray(input.settings)))throw new Error('settings 必须是对象');
    var d=clone(input),ids={};
    d.accounts.forEach(function(a,i){if(!a||typeof a!=='object')throw new Error('账户 #'+(i+1)+' 格式错误');if(!validId(a.id)||ids[a.id])throw new Error('账户 ID 无效或重复：'+String(a.id));ids[a.id]=true;if(!finiteNumber(a.balance))throw new Error('账户余额必须是有限数字：'+a.id);if(!allowLegacy&&!allowedIcon(a.icon))throw new Error('账户图标不在允许列表：'+a.id);if(!allowLegacy&&!validColor(a.color))throw new Error('账户颜色无效：'+a.id);a.balance=r2(a.balance);a.name=safeText(a.name,60,'未命名账户');a.icon=faIcon(a.icon,ICON_CARD);a.color=validColor(a.color)?a.color:'#BAE1FF';});
    var catIds={};
    d.categories.forEach(function(c,i){if(!c||typeof c!=='object')throw new Error('分类 #'+(i+1)+' 格式错误');if(!validId(c.id)||catIds[c.id])throw new Error('分类 ID 无效或重复：'+String(c.id));if(c.kind!=='expense'&&c.kind!=='income')throw new Error('分类类型无效：'+c.id);if(!allowLegacy&&!allowedIcon(c.icon))throw new Error('分类图标不在允许列表：'+c.id);if(!allowLegacy&&!validColor(c.color))throw new Error('分类颜色无效：'+c.id);catIds[c.id]=true;c.name=safeText(c.name,60,'未命名分类');c.icon=faIcon(c.icon,ICON_TAG);c.color=validColor(c.color)?c.color:'#BAE1FF';});
    var txIds={};
    d.transactions.forEach(function(t,i){if(!t||typeof t!=='object')throw new Error('流水 #'+(i+1)+' 格式错误');if(!validId(t.id)||txIds[t.id])throw new Error('流水 ID 无效或重复：'+String(t.id));txIds[t.id]=true;if(['expense','income','transfer'].indexOf(t.kind)<0)throw new Error('流水类型无效：'+t.id);if(!finiteNumber(t.amount)||t.amount<=0)throw new Error('流水金额必须是大于 0 的有限数字：'+t.id);if(!validDate(t.date))throw new Error('流水日期无效：'+t.id);if(!allowLegacy&&!ids[t.accountId])throw new Error('流水引用了不存在的账户：'+t.id);if(t.kind==='transfer'){if(!allowLegacy&&!ids[t.toAccountId])throw new Error('转账引用了不存在的转入账户：'+t.id);if(t.accountId===t.toAccountId)throw new Error('转账的转出和转入账户不能相同：'+t.id);}else if(!allowLegacy&&!catIds[t.categoryId])throw new Error('流水引用了不存在的分类：'+t.id);t.amount=r2(t.amount);t.note=safeText(t.note,5000,'');t.ts=finiteNumber(t.ts)?t.ts:Date.now()+i;});
    return migrate(d);
  }
  function load(){var raw=null;try{raw=localStorage.getItem(KEY);}catch(e){loadError={message:'无法读取本地存储：'+e.message,raw:''};return state;}if(!raw){state=blank();try{save();}catch(e2){loadError={message:'无法初始化本地存储：'+e2.message,raw:''};}return state;}try{state=validateData(JSON.parse(raw),true);try{save();}catch(writeError){loadError={message:'存档已读取，但无法写入迁移结果：'+writeError.message,raw:raw};}}catch(e3){saveRecovery(raw,'存档损坏或结构无效：'+e3.message);state=blank();}return state;}

  function getAccounts(options){var include=!options||options.includeArchived!==false;return state.accounts.filter(function(a){return include||!a.archived;}).slice().sort(function(a,b){return a.order-b.order;});}
  function getActiveAccounts(){return getAccounts({includeArchived:false});}
  function getAccount(id){return state.accounts.filter(function(a){return a.id===id;})[0]||null;}
  function accountBalance(id){var a=getAccount(id);if(!a)return 0;var cents=Math.round(a.balance*100);state.transactions.forEach(function(t){var amount=Math.round(t.amount*100);if(t.kind==='transfer'){if(t.accountId===id)cents-=amount;if(t.toAccountId===id)cents+=amount;}else if(t.accountId===id)cents+=t.kind==='income'?amount:-amount;});return cents/100;}
  function totalAssets(){return getAccounts().reduce(function(s,a){return s+Math.round(accountBalance(a.id)*100);},0)/100;}
  function updateAccount(id,patch){return mutate(function(){var a=getAccount(id);if(!a)throw new Error('账户不存在');if(patch.name!=null)a.name=safeText(patch.name,60);return a;});}
  function addAccount(name,icon,color,initialBalance){return mutate(function(){var bal=initialBalance==null?0:initialBalance;if(!finiteNumber(bal))throw new Error('初始余额必须是有限数字');var a={id:uid('a'),name:safeText(name,60),icon:faIcon(icon,ICON_CARD),color:validColor(color)?color:'#BAE1FF',balance:r2(bal),order:state.accounts.length,archived:false};state.accounts.push(a);return a;});}
  function setAccountBalance(id,target){return mutate(function(){if(!finiteNumber(target))throw new Error('余额必须是有限数字');var a=getAccount(id);if(!a)throw new Error('账户不存在');a.balance=r2(a.balance+target-accountBalance(id));return a;});}
  function saveAccount(id,name,target){return mutate(function(){if(!finiteNumber(target))throw new Error('余额必须是有限数字');var a=getAccount(id);if(!a)throw new Error('账户不存在');var current=accountBalance(id);a.name=safeText(name,60,a.name);a.balance=r2(a.balance+target-current);return a;});}
  function reorderAccounts(ids){return mutate(function(){ids.forEach(function(id,i){var a=getAccount(id);if(a&&!a.archived)a.order=i;});});}
  function countAccountTx(id){return state.transactions.filter(function(t){return t.accountId===id||t.toAccountId===id;}).length;}
  function archiveAccount(id){return mutate(function(){var a=getAccount(id);if(!a)throw new Error('账户不存在');if(!countAccountTx(id))throw new Error('无流水账户请直接删除');a.archived=true;return a;});}
  function restoreAccount(id){return mutate(function(){var a=getAccount(id);if(!a)throw new Error('账户不存在');var nextOrder=getActiveAccounts().length;a.archived=false;a.order=nextOrder;return a;});}
  function deleteAccount(id){return mutate(function(){if(countAccountTx(id))throw new Error('该账户有历史流水，只能归档');state.accounts=state.accounts.filter(function(a){return a.id!==id;});});}
  function getCategories(kind){return state.categories.filter(function(c){return!kind||c.kind===kind;}).slice().sort(function(a,b){return a.order-b.order;});}
  function getCategory(id){return state.categories.filter(function(c){return c.id===id;})[0]||null;}
  function addCategory(name,icon,color,kind){return mutate(function(){if(kind!=='expense'&&kind!=='income')throw new Error('分类类型无效');var c={id:uid('c'),name:safeText(name,60),icon:faIcon(icon,ICON_TAG),color:validColor(color)?color:'#FFFFBA',kind:kind,order:state.categories.length};state.categories.push(c);return c;});}
  function updateCategory(id,patch){return mutate(function(){var c=getCategory(id);if(!c)throw new Error('分类不存在');if(patch.name!=null)c.name=safeText(patch.name,60);if(patch.icon!=null)c.icon=faIcon(patch.icon,ICON_TAG);return c;});}
  function reorderCategories(ids){return mutate(function(){ids.forEach(function(id,i){var c=getCategory(id);if(c)c.order=i;});});}
  function countCategoryTx(id){return state.transactions.filter(function(t){return t.categoryId===id;}).length;}
  function deleteCategory(id){return mutate(function(){var c=getCategory(id);if(!c)throw new Error('分类不存在');if(id==='c-other'||id==='c-inoth')throw new Error('默认“其他”分类不能删除');var fallback=c.kind==='income'?'c-inoth':'c-other';state.transactions.forEach(function(t){if(t.categoryId===id)t.categoryId=fallback;});state.categories=state.categories.filter(function(x){return x.id!==id;});});}
  function getTransactions(){return state.transactions.slice().sort(function(a,b){if(a.date!==b.date)return a.date<b.date?1:-1;return b.ts-a.ts;});}
  function validateTransaction(t){if(['expense','income','transfer'].indexOf(t.kind)<0)throw new Error('流水类型无效');if(!finiteNumber(t.amount)||t.amount<=0)throw new Error('金额必须大于 0');if(!validDate(t.date))throw new Error('日期无效');if(!getAccount(t.accountId))throw new Error('账户不存在');if(t.kind==='transfer'){if(!getAccount(t.toAccountId))throw new Error('转入账户不存在');if(t.accountId===t.toAccountId)throw new Error('转出和转入账户不能相同');}else{var c=getCategory(t.categoryId);if(!c||c.kind!==t.kind)throw new Error('分类不存在或与收支类型不匹配');}t.amount=r2(t.amount);t.note=safeText(t.note,5000,'');return t;}
  function addTransaction(t){return mutate(function(){var x=validateTransaction(Object.assign({},t));x.id=uid('t');x.ts=Date.now();state.transactions.push(x);return x;});}
  function deleteTransaction(id){return mutate(function(){state.transactions=state.transactions.filter(function(t){return t.id!==id;});});}
  function updateTransaction(id,patch){return mutate(function(){var t=state.transactions.filter(function(x){return x.id===id;})[0];if(!t)throw new Error('流水不存在');var next=validateTransaction(Object.assign({},t,patch));Object.assign(t,next);return t;});}
  function summary(from,to){var inc=0,exp=0;state.transactions.forEach(function(t){if(t.date<from||t.date>to||t.kind==='transfer')return;if(t.kind==='income')inc+=Math.round(t.amount*100);else exp+=Math.round(t.amount*100);});return{income:inc/100,expense:exp/100};}
  function byCategory(from,to,kind){var map={};state.transactions.forEach(function(t){if(t.date>=from&&t.date<=to&&t.kind===kind)map[t.categoryId]=(map[t.categoryId]||0)+Math.round(t.amount*100);});return Object.keys(map).map(function(id){var c=getCategory(id);return{id:id,name:c?c.name:'其他',icon:c?c.icon:ICON_TAG,color:c?c.color:'#CCCCCC',value:map[id]/100};}).sort(function(a,b){return b.value-a.value;});}
  function monthlySummaries(from,to){
    if(!validDate(from)||!validDate(to))throw new Error('日期范围无效');if(from>to){var swap=from;from=to;to=swap;}
    var first=new Date(from+'T00:00:00'),cur=new Date(first.getFullYear(),first.getMonth(),1),out=[];
    while(localDate(cur)<=to){var ym=cur.getFullYear()+'-'+p2(cur.getMonth()+1),monthStart=ym+'-01',monthEnd=localDate(new Date(cur.getFullYear(),cur.getMonth()+1,0));var clippedFrom=monthStart<from?from:monthStart,clippedTo=monthEnd>to?to:monthEnd;var s=summary(clippedFrom,clippedTo);out.push({label:(cur.getMonth()+1)+'月',from:clippedFrom,to:clippedTo,income:s.income,expense:s.expense});cur.setMonth(cur.getMonth()+1);}return out;
  }
  function settings(){return state.settings;}
  function setSetting(k,v){return mutate(function(){if(k==='dark')state.settings.dark=!!v;else if(k==='nickname')state.settings.nickname=safeText(v,20,'Dora');else throw new Error('未知设置项');});}
  function exportJSON(){return JSON.stringify(state,null,2);}
  function previewImport(text){var parsed;try{parsed=JSON.parse(text);}catch(e){throw new Error('JSON 解析失败：'+e.message);}var legacy=!parsed.schemaVersion||parsed.schemaVersion<SCHEMA_VERSION;var data=validateData(parsed,legacy),dates=data.transactions.map(function(t){return t.date;}).sort();return{data:data,summary:{accounts:data.accounts.length,categories:data.categories.length,transactions:data.transactions.length,from:dates[0]||'无',to:dates[dates.length-1]||'无'}};}
  function commitImport(preview){var next=preview&&preview.data?validateData(preview.data,true):null;if(!next)throw new Error('导入预览无效');var before=clone(state);try{localStorage.setItem(KEY+'-backup-'+Date.now(),JSON.stringify(state));state=next;save();loadError=null;return true;}catch(e){state=before;throw new Error('导入失败：'+e.message);}}
  function importJSON(text){return commitImport(previewImport(text));}
  function clearAll(){if(loadError)throw new Error('存档损坏时请使用“确认放弃并重置”');var before=clone(state);try{state=blank();save();}catch(e){state=before;throw e;}}
  function getLoadError(){return loadError;}function exportRecovery(){return loadError?loadError.raw:'';}function discardCorruptAndReset(){state=blank();save();loadError=null;}
  load();
  return {getAccounts:getAccounts,getActiveAccounts:getActiveAccounts,getAccount:getAccount,accountBalance:accountBalance,totalAssets:totalAssets,updateAccount:updateAccount,addAccount:addAccount,setAccountBalance:setAccountBalance,saveAccount:saveAccount,reorderAccounts:reorderAccounts,countAccountTx:countAccountTx,archiveAccount:archiveAccount,restoreAccount:restoreAccount,deleteAccount:deleteAccount,getCategories:getCategories,getCategory:getCategory,addCategory:addCategory,updateCategory:updateCategory,reorderCategories:reorderCategories,countCategoryTx:countCategoryTx,deleteCategory:deleteCategory,getTransactions:getTransactions,addTransaction:addTransaction,deleteTransaction:deleteTransaction,updateTransaction:updateTransaction,summary:summary,byCategory:byCategory,monthlySummaries:monthlySummaries,settings:settings,setSetting:setSetting,exportJSON:exportJSON,previewImport:previewImport,commitImport:commitImport,importJSON:importJSON,clearAll:clearAll,getLoadError:getLoadError,exportRecovery:exportRecovery,discardCorruptAndReset:discardCorruptAndReset,faIcon:faIcon,VERSION:VERSION,SCHEMA_VERSION:SCHEMA_VERSION,_validateData:validateData};
})();
