import{i18n,DB_KEY,browser}from"../js/cllama.js";import{replaceElementContent}from"../js/util.js";document.addEventListener("DOMContentLoaded",function(){let n=document.getElementById("config-list");var e=document.getElementById("add-config-btn"),t=document.getElementById("save-config-btn");let r=new bootstrap.Modal(document.getElementById("addConfigModal")),l=document.getElementById("url"),o=document.getElementById("css-selector");var d=[];let s=new DOMParser;function a(t){var e=`
        <table>
            <tr id="cu_${t.id}">
                <td>${t.url}</td>
                <td>${t.cssSelector}</td>
                <td class="ucaction">
                    <button class="btn btn-danger btn-sm delete">一</button>
                </td>
            </tr>
        </table>
        `,e=s.parseFromString(e,"text/html").body.getElementsByTagName("tr")[0].cloneNode(!0);e.getElementsByTagName("button")[0].addEventListener("click",()=>{d=d.filter(e=>e.id!=t.id),browser.storage.local.set({[DB_KEY.urls]:d}),document.getElementById("cu_"+t.id).remove()}),n.appendChild(e)}e.addEventListener("click",()=>{r.show()}),t.addEventListener("click",e=>{var t=l.value,n=o.value;t.startsWith("http://")||t.startsWith("https://")||(alert(browser.i18n.getMessage("urlPrefixError")),e.preventDefault()),t&&n&&(e={url:t,cssSelector:n,id:(new Date).getTime()},d.push(e),a(e),browser.storage.local.set({[DB_KEY.urls]:d}),l.value="",o.value="",r.hide())}),browser.storage.local.get(DB_KEY.urls,function(e){for(var t of d=(d=e[DB_KEY.urls])||[])a(t)}),i18n()});