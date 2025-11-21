let browser="undefined"!=typeof chrome?chrome:void 0!==browser?browser:null,isFirefox=0<=navigator.userAgent.indexOf("Firefox");function getPageInfo(){return new Promise(r=>{let o=window.location.href,n=document.body.innerText;browser.storage.local.get("urls",e=>{var t;for(t of e.urls||[])if(o.startsWith(t.url)){if(n="",document.body.querySelectorAll(t.cssSelector).forEach(e=>{n+=e.innerText+" "}),!(n.length<1))break;console.error("根据css选择器["+t.cssSelector+"]没有找到合适的内容，恢复到取页面所有信息"),n=document.body.innerText}r({title:document.title,content:n,url:o})})})}function sendMessageToBackground(e,o){return new Promise((t,r)=>{e?browser.runtime.sendMessage(o).then(e=>t(e)).catch(e=>r(e)):browser.runtime.sendMessage(o,e=>{browser.runtime.lastError?r(browser.runtime.lastError):t(e)})})}let translate_div_id="cllama_translate_div";function showTranslateDiv(e){var r=document.getElementById(translate_div_id);if(r)r.textContent=browser.i18n.getMessage("translateWiatMessage");else{r=`<div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(160, 160, 160, 0.96);
          border: 1px solid rgb(204, 204, 204);
          padding: 20px 15px 10px 10px;
          box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 10px;
          width: 580px;
          height: 390px;
          z-index: 999;
          border-radius: 10px;
          font-size: 1.2rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        ">
          <button id="close_translate_div"
            style="
              position: absolute;
              color: rgb(120, 113, 113);
              text-decoration: none;
              font-size: 21pt;
              right: 0px;
              top: 0px;
              line-height: 25px;
              z-index: 1000;
              background: rgba(160, 160, 160, 0.96);
              border-radius: 3px;
              transition: opacity 0.2s;
              border: none;
              outline: none;
              min-width: 30px;
            ">⊗</button>
          
          <div 
            id="cllama_translate_div" 
            style="
              margin-top: 25px;
              font-size: 15px;
              width: 100%;
              height: calc(100% - 15px);
              overflow-y: auto;
              padding-right: 10px;
              scrollbar-width: thin;
              scrollbar-color: rgba(0,0,0,0.2) transparent;
              line-height: 1.6;
              text-align: justify;
              color: #333;
              margin-bottom: 5px;
            text-justify: inter-ideograph; 
            word-break: break-word;  
            hyphens: auto;  
            ">${e}</div>
        </div>`;let t=(new DOMParser).parseFromString("<div>"+r+"</div>","text/html").body.firstChild.cloneNode(!0);document.body.appendChild(t),document.getElementById("close_translate_div").addEventListener("click",e=>{sendMessageToBackground(isFirefox,"close_translate").then(e=>setTimeout(function(){t.remove()},50)).catch(e=>console.error("Error:",e)),e.preventDefault()})}}function showTranslate(e){return document.getElementById(translate_div_id).innerText=e,!1}browser.runtime.onMessage.addListener((e,t,r)=>{var o;return"getPageInfo"===e.action?chrome?getPageInfo().then(e=>{r(e)}).catch(e=>{r({success:!1,error:e})}):(o=getPageInfo(),r(o)):"translate"===e.action&&(showTranslateDiv(e.msg),showTranslate(e.msg)),!0}),window.addEventListener("message",e=>{e.source!==window||"callImportInsightPrompt"!==e.data.type&&"callImportAIdirPrompt"!==e.data.type||browser.runtime.sendMessage({action:e.data.type,data:e.data.payload},e=>{window.postMessage({type:"EXTENSION_RESPONSE",payload:e},"*")})});