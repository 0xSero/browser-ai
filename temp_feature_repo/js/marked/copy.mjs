import{findMatchingParentNode,hasClass,openHtmlInNewTab}from"../util.js";function copyToClipboard(e){e.querySelectorAll("pre").forEach(function(e){hasClass(e,"self-message")||findMatchingParentNode(e,".think")||e.getAttribute("toolbar")||createToolbarCoder(e)})}function createToolbarCoder(e){var t=`
                <div class="code-container">
                    <!-- 工具条 -->
                    <div class="toolbar d-flex justify-content-between">
                        <a href="#" class="run btn-sm btn-outline-primary btn-toolbar" style="border:0px;visibility: hidden;" title="Click to Run">
                            <svg class="bi theme-icon-active"><use href="#svg_run"></use></svg>
                        </a>
                        <div class="btn-group">
                            <a href="#" class="download btn-sm btn-outline-secondary btn-toolbar" title="Click to Download" style="border:0px;display:none;">
                                <svg class="bi theme-icon-active"><use href="#svg_download"></use></svg>
                            </a>
                            <a href="#" class="copy btn-sm btn-outline-secondary btn-toolbar" title="Click to Copy" style="border:0px;">
                                <svg class="bi theme-icon-active svgcopy"><use href="#svg_copy"></use></svg>
                                <svg class="bi theme-icon-active svgcheck" style="display:none;"><use href="#svg_check"></use></svg>
                            </a>                            
                        </div>                        
                    </div>
                    <pre style="margin-bottom: 0px;">${e.innerHTML}</pre>
                </div>
    `,t=(new DOMParser).parseFromString("<div>"+t+"</div>","text/html");let l=t.body.firstChild.cloneNode(!0),a=e.textContent.trim(),r=hasClass(t.getElementsByTagName("code")[0],"language-html"),o=((a.startsWith("<svg")||r)&&((t=l.querySelector(".run")).style.visibility="visible",t.addEventListener("click",e=>{openHtmlInNewTab(a),e.preventDefault()}),l.querySelector(".download").style.display="",l.querySelector(".download").addEventListener("click",e=>{var t=r?"html":"svg",l=new Blob([a],{type:"application/"+t});let o=URL.createObjectURL(l),n=document.createElement("a");n.href=o;l=Date.now();n.download=l+"."+t,document.body.appendChild(n),n.click(),setTimeout(()=>{document.body.removeChild(n),URL.revokeObjectURL(o)},100),e.preventDefault()})),null);l.querySelector(".copy").addEventListener("click",e=>{navigator.clipboard.writeText(a),l.querySelector(".copy").querySelector(".svgcopy").style.display="none",l.querySelector(".copy").querySelector(".svgcheck").style.display="",clearTimeout(o),o=setTimeout(function(){l.querySelector(".copy").querySelector(".svgcopy").style.display="",l.querySelector(".copy").querySelector(".svgcheck").style.display="none"},2e3),e.preventDefault()}),l.querySelector("pre").setAttribute("toolbar",!0),e.parentNode.replaceChild(l,e)}function thinkCollapseExpanded(e){e.querySelectorAll(".think").forEach(function(e){collapseExpanded(e)})}function collapseExpanded(e){var l=e.innerHTML;if(15<l.length){let t=getFoldabeContent(l);t.querySelectorAll(".collapse-expand").forEach(function(e){e.addEventListener("click",e=>{t.querySelector(".think-content-wrapper").classList.toggle("think-collapsed"),t.classList.toggle("think-expanded"),e.preventDefault()})}),e.parentNode.replaceChild(t,e)}}function getFoldabeContent(e){e=`<div class="think-foldable-content" id="container">
        <div class="think-content-wrapper think-collapsed">
            <div class="think">${e}</div>
        </div>
        <span class="expand-btn collapse-expand"></span>
        <div class="collapse-btn collapse-expand">‹‹‹</div>
    </div>`;return(new DOMParser).parseFromString("<div>"+e+"</div>","text/html").body.firstChild.cloneNode(!0)}export{copyToClipboard,thinkCollapseExpanded};