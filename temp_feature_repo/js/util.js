import { TextProcessor } from "./text-processor.mjs";

const browser = typeof chrome !== 'undefined' ? chrome : browser;
const isFirefox = navigator.userAgent.indexOf('Firefox') >= 0;

export function sendToContentScript(message) {

  return new Promise((resolve, reject) => {

    //参数校验
    if (typeof message !== 'object' || message === null) {
      reject(new TypeError('Message must be an object'));
      return;
    }
    if (typeof message.action !== 'string' || message.action.trim() === '') {
      reject(new TypeError('message.action must be a non-empty string'));
      return;
    }

    //查询当前活动的标签页
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // 检查查询错误
      if (browser.runtime?.lastError) {
        const errorMessage = browser.runtime.lastError.message || 'Failed to query tabs';
        reject(new Error(errorMessage));
        return;
      }

      // 检查标签页是否存在
      if (!tabs?.[0]?.id) {
        reject(new Error('No active tab found'));
        return;
      }

      if (isFirefox) {
        browser.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (browser.runtime?.lastError) {
            const sendError = browser.runtime.lastError.message || 'Message failed to send';
            reject(new Error(sendError));
            return;
          }
          resolve(response);
        });
      } else {
        browser.tabs.sendMessage(tabs[0].id, message)
          .then(resolve)
          .catch(reject);
      }
    });
  });
}

export function hasClass(element, value) {
  if(!element) return false;
  var cls = value || '';
  //\s 匹配任何空白字符，包括空格、制表符、换页符等等
  if (cls.replace(/\s/g, '').length == 0) {
    return false;   //当没有参数返回时，返回false
  }
  return new RegExp(' ' + cls + ' ').test(' ' + element.className + ' ');
}

export function removeClass(element, value) {
  if (hasClass(element, value)) {
    //\t 匹配一个制表符；\r 匹配一个回车符；\n 匹配一个换行符
    var newClass = ' ' + element.className.replace(/\t\r\n/g, '') + ' ';
    while (newClass.indexOf(' ' + value + ' ') > -1) {
      newClass = newClass.replace(' ' + value + ' ', ' ');
    }
    element.className = newClass.replace(/^\s+|\s+$/g, '');
  }
}

export function addClass(element, value) {
  if (!hasClass(element, value)) {
    element.className = element.className == '' ? value : element.className + ' ' + value;
  }
}

export function getLanguageCode() {
  return getLanguageCode1().replace("-", "_");
}

export const getQueryParam = (paramName) =>
  paramName ? new URLSearchParams(window.location.search).get(paramName) : null;

export function replaceElementContent(target, content) {
  try {
    const parent = target.parentElement || document.body;
    const elements = target instanceof Element ? [target] : [...parent.querySelectorAll(target)];
    if (!elements.length) return false;

    const createContent = typeof content === 'function' ? content : () => {
      const doc = new DOMParser().parseFromString("<div>" + content + "</div>", 'text/html');
      return doc.body.firstChild.cloneNode(true);
    };

    elements.forEach(el => {
      el.replaceChildren(createContent());
    });
    return true;
  } catch (error) {
    console.error('Content replacement failed:', error);
    return false;
  }
}

export function adjustMessagesToTokenLimit(messages, maxTokens) {
  // 计算消息数组的总token数（包括role字段）
  function calculateTotalTokens(msgs) {
    return msgs.reduce((total, msg) => {
      return total + TextProcessor.estimateTokens(`${msg.role}\n${msg.content}`);
    }, 0);
  }

  // 创建消息副本避免修改原数组
  const adjustedMessages = [...messages];
  let totalTokens = calculateTotalTokens(adjustedMessages);

  // 情况1：如果token数已经满足要求，直接返回
  if (totalTokens <= maxTokens) {
    return adjustedMessages;
  }

  // 确定最小保留消息数（如果有system消息且是第一条，则至少保留2条）
  const hasSystemFirst = adjustedMessages[0]?.role === 'system';
  const minMessagesToKeep = hasSystemFirst ? 2 : 1;

  // 情况2：尝试删除消息直到满足要求
  while (totalTokens > maxTokens && adjustedMessages.length > minMessagesToKeep) {
    // 总是从最早的非system消息开始删除（保留system消息）
    const removeIndex = hasSystemFirst ? 1 : 0;
    const removed = adjustedMessages.splice(removeIndex, 1)[0];
    totalTokens -= TextProcessor.estimateTokens(`${removed.role}\n${removed.content}`);
  }

  // 情况3：如果删除后仍不满足，尝试截断最后一条消息
  if (totalTokens > maxTokens && adjustedMessages.length >= minMessagesToKeep) {
    const lastMsg = adjustedMessages[adjustedMessages.length - 1];
    const lastMsgTokenCount = TextProcessor.estimateTokens(`${lastMsg.role}\n${lastMsg.content}`);
    const availableTokens = maxTokens - (totalTokens - lastMsgTokenCount);

    if (availableTokens > 0) {
      // 计算需要保留的内容token数（减去role占用的token）
      const roleTokenCount = TextProcessor.estimateTokens(`${lastMsg.role}\n`);
      const contentMaxTokens = Math.max(1, availableTokens - roleTokenCount);

      const originalContent = lastMsg.content;
      const truncatedContent = TextProcessor.truncateToTokens(originalContent, contentMaxTokens);

      // 检查截断后内容是否保留至少一半长度
      /*if (truncatedContent.length >= originalContent.length / 2) {*/
      lastMsg.content = truncatedContent;
      totalTokens = maxTokens; // 此时应该正好等于maxTokens
      return adjustedMessages;
      //}
    }
  }

  // 最终检查：如果仍不满足，但满足最小消息数要求，则返回
  if (adjustedMessages.length >= minMessagesToKeep) {
    return adjustedMessages;
  }

  // 极端情况：无法满足要求（如maxTokens太小），返回空数组
  return [];
}

//转义HTML字符串
export function htmlEncode(html) {
  var temp = document.createElement("div");
  (temp.textContent != null) ? (temp.textContent = html) : (temp.innerText = html);
  var output = temp.innerHTML;
  temp = null;
  return output;
}

function getLanguageCode1() {
  const supportedLocales = ['zh-CN', 'de', 'en', 'fr', 'pt-BR', 'pt-PT', 'ja', 'ru', 'es'];

  // 获取当前用户的语言设置
  var userLang = browser.i18n.getUILanguage();

  // 如果用户语言在支持的语言列表中，直接返回该区域的代码
  for (var i = 0; i < supportedLocales.length; i++) {
    if (userLang.startsWith(supportedLocales[i])) {
      return supportedLocales[i];
    }
  }

  if (/zh/i.test(userLang)) {
    return 'zh-Hant'; // 返回繁体中文作为默认值
  }

  // 检查是否为葡萄牙语相关语言
  if (/pt/i.test(userLang)) {
    return userLang.startsWith('pt-BR') ? 'pt-BR' : 'pt-PT'; // 根据具体区域返回相应的代码
  }

  // 如果都不是，默认返回英语
  return 'en';
}

/**
 * 在新标签页中打开并显示HTML字符串
 * @param {string} htmlString - 要显示的HTML内容
 * @param {string} [title='New Page'] - 新页面的标题(可选)
 */
export function openHtmlInNewTab(htmlString, title = 'New Page') {
  browser.runtime.sendMessage({
    action: 'openHtmlInNewTab',
    data: {
      htmlString: htmlString,
      title: title
    }
  });
}

export function findMatchingParentNode(node, ...selectors) {
  // 使用字符串模板创建一个复合CSS选择器
  // 将多个选择器用逗号分隔开，形成一个选择器组
  const combinedSelector = selectors.join(', ');

  // 从给定的节点开始向上查找
  while (node && node.parentNode && node.parentNode !== document.body.parentNode) { // 检查 node 是否为空，避免报错，并且在到达 body 元素时停止
    // 使用querySelector来检查当前节点的父节点是否匹配复合选择器
    if (node.parentNode.matches(combinedSelector)) {
      return node.parentNode; // 找到匹配的父节点，返回它
    }
    // 如果没有找到，移动到父节点继续查找
    node = node.parentNode;
  }
  // 没有找到匹配的父节点，返回null
  return null;
}

export function replaceThinkTags(inputText) {

  if (typeof inputText !== 'string' || inputText.length === 0) {
    return inputText;
  }

  let result = inputText.replace(/<\/think>/g, '</div>');
  result = result.replace(/<think>/g, '<div class="think">');

  return result;
}

export function removeThinkTags(str) {
  if(!str)
    return "";
  const regex = /<think>[\s\S]*?<\/think>/g;
  // 使用空字符串替换匹配到的内容
  return str.replace(regex, "");
}


export function exportFile(data, format, fileName) {

  const ftype = 'application/'+format;

  // 创建Blob对象
  const blob = new Blob([data], { type: ftype });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if(!fileName)
    fileName = new Date().getTime()+"."+format;
  a.download = fileName;

  // 触发点击事件下载文件
  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function cloneProperties(original, properties) {
  let clonedObject = {};
  properties.forEach(property => {
      if (original.hasOwnProperty(property)) {
          clonedObject[property] = original[property];
      }
  });
  return clonedObject;
}

export function cloneOllamaOptions(options){
  const props = ["num_keep", "num_predict", "seed", "top_k", "top_p", "min_p", "think", "repeat_last_n", "temperature", "num_ctx", "stop"];
  return cloneProperties(options, props);
}

/**
 * 根据时间戳格式化时间字符串。
 * 如果是当天的时间戳，返回 'HH:mm' 格式。
 * 如果不是当天的时间戳，返回 'YYYY-MM-DD HH:mm' 格式。
 *
 * @param {number} timestamp - 需要格式化的时间戳（毫秒）。
 * @returns {string} 格式化后的时间字符串。
 */
export function formatTimestamp(timestamp) {
  // 创建一个Date对象，用于获取时间组件
  const date = new Date(timestamp);

  // 检查时间戳是否有效
  if (isNaN(date.getTime())) {
    return 'Invalid Date'; // 或者返回其他错误提示
  }

  // 获取当前日期，用于判断是否为当天
  const now = new Date();

  // 提取时间组件
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() 返回 0-11，所以需要加 1
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // 提取当前日期组件
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();

  // 辅助函数，用于给小于10的数字前面补0
  const padZero = (num) => {
    return num < 10 ? '0' + num : num;
  };

  // 判断是否为当天
  const isToday = (year === nowYear) &&
                  (month === nowMonth) &&
                  (day === nowDay);

  // 根据是否为当天返回不同的格式
  if (isToday) {
    return `${padZero(hours)}:${padZero(minutes)}`;
  } else {
    return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(minutes)}`;
  }
}
