function confirm(c,m={}){let b="undefined"!=typeof chrome?chrome:b;return new Promise(e=>{const t=m.okText||b.i18n.getMessage("confirm"),d=m.cancelText||b.i18n.getMessage("cancel"),o=m.title||"Confirmation";let n=document.createElement("div"),a=(n.className="modal fade",n.tabIndex=-1,n.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${o}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${c}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${d}</button>
            <button type="button" class="btn btn-primary">${t}</button>
          </div>
        </div>
      </div>
    `,document.body.appendChild(n),new bootstrap.Modal(n)),s=n.querySelector(".btn-primary");var i=n.querySelector(".btn-secondary");let l=()=>{r(),e(!1)},r=()=>{a.hide(),n.removeEventListener("hidden.bs.modal",l),n.remove()};s.addEventListener("click",()=>{r(),e(!0)}),i.addEventListener("click",l),n.addEventListener("hidden.bs.modal",l),a.show(),n.addEventListener("shown.bs.modal",()=>{s.focus()})})}function balert(l,r={}){return new Promise(e=>{const t=r.okText||"Close",d=r.title||"Information";let o=document.createElement("div"),n=(o.className="modal fade",o.tabIndex=-1,o.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${d}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${l}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary">${t}</button>
          </div>
        </div>
      </div>
    `,document.body.appendChild(o),new bootstrap.Modal(o)),a=o.querySelector(".btn-primary"),s=()=>{i(),e(!1)},i=()=>{n.hide(),o.removeEventListener("hidden.bs.modal",s),o.remove()};a.addEventListener("click",s),o.addEventListener("hidden.bs.modal",s),n.show(),o.addEventListener("shown.bs.modal",()=>{a.focus()})})}export{confirm,balert};