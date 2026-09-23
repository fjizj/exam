/**
 * 共用輔助函數：從指定的群組容器中解析出所有的考古題（支援新舊格式）
 * @param {Element} groupElement - .group-container DOM 元素
 * @returns {Array} 題目物件陣列
 */
function extractQuestionsFromGroup(groupElement) {
    const termCards = groupElement.querySelectorAll('.term-card');
    const questions = [];
    const groupName = groupElement.querySelector('.group-header')?.textContent || '測驗';

    termCards.forEach((card, index) => {
        // 尋找卡片內的 exam-table td
        const tds = card.querySelectorAll('.exam-table td');

        if (tds.length >= 2) {
            // 舊格式：日文 / 中文對照表格式
            const jaCell = tds[0];
            const zhCell = tds[1];

            questions.push({
                cardIndex: index,
                jaContent: jaCell.innerHTML,
                zhContent: zhCell.innerHTML,
                termTitle: card.querySelector('.term-ja')?.textContent || 
                           card.querySelector('.term-zh')?.textContent || '',
                groupName: groupName
            });
        }
    });

    return questions;
}

/**
 * 共用輔助函數：將題庫存入 localStorage 並跳轉到測驗頁面
 * @param {Array} questions - 題目陣列
 * @param {string} groupName - 測驗標題/群組名稱
 * @param {number|null} limitCount - 限制隨機抽取的題數（若為 null 則保留全部）
 */
function initAndRedirectQuiz(questions, groupName, limitCount = null, isIndex=false) {
    if (questions.length === 0) {
        alert('沒有找到任何考古題！');
        return;
    }
	
	let finalQuestions = [...questions];

    // 如果有設定限制數量，則進行隨機打亂並切片
    if (limitCount !== null && finalQuestions.length > limitCount) {
        // Fisher-Yates Shuffle 演算法打亂順序
        for (let i = finalQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
        }
        finalQuestions = finalQuestions.slice(0, limitCount);
    }
	
    // 將題庫與群組資訊存到 localStorage
    localStorage.setItem('quizQuestions', JSON.stringify(finalQuestions));
    localStorage.setItem('quizGroupName', groupName);
    localStorage.setItem('quizScore', '0');
    localStorage.setItem('quizTotal', '0');

    // 跳轉到測驗頁面
	if(isIndex)
		window.location.href = 'quiz.html';
	else
		window.location.href = '../quiz.html';
}

/**
 * 單一分類測驗按鈕觸發函數
 */
function startQuiz(buttonElement) {
    const currentGroup = buttonElement.closest('.group-container');
    
    if (!currentGroup) {
        console.error('錯誤：找不到 .group-container，請確認按鈕是否位在 .group-container 內部！');
        return;
    }

    const questions = extractQuestionsFromGroup(currentGroup);
    const groupName = currentGroup.querySelector('.group-header')?.textContent || '測驗';

    // 調用共用跳轉函數（limitCount 傳入 null，代表全部題目）
    initAndRedirectQuiz(questions, groupName, null);
}

/**
 * 綜合測驗按鈕觸發函數：抓取頁面所有 group-container 的題目，隨機抽出指定題數
 * @param {number} [limit=20] - 隨機抽取的題數，預設為 20
 */
function startComprehensiveQuiz(limit = 20) {
    const allGroups = document.querySelectorAll('.group-container');
    
    if (allGroups.length === 0) {
        console.error('錯誤：找不到任何 .group-container！');
        return;
    }

    let allQuestions = [];

    allGroups.forEach((group) => {
        const groupQuestions = extractQuestionsFromGroup(group);
        allQuestions = allQuestions.concat(groupQuestions);
    });
    const groupName = document.querySelector('h1')?.textContent || '綜合測驗';

    // 調用共用跳轉函數（傳入 limit 變數作為隨機抽題數量）
    initAndRedirectQuiz(allQuestions, groupName, limit);
}

/**
 * 取得測驗題目
 * @param {Element} btnElement - 被點擊的按鈕元素
 */
async function getCategoryQuizFromButton(cardElement) {
    if (!cardElement) 
		return;

    // 3. 自動抓取該卡片內所有 sub_category__link 的 href 作為 urls
    const linkElements = cardElement.querySelectorAll('.sub_category__link');
    const urls = Array.from(linkElements).map(a => a.getAttribute('href')).filter(Boolean);

    if (urls.length === 0) {
        alert('找不到任何子分類網址！');
        return;
    }

    let allQuestions = [];

    try {
        // 4. 同時使用 fetch 讀取這些網址對應的網頁
        const htmlPromises = urls.map(url => 
            fetch(url).then(res => {
                if (!res.ok) throw new Error(`無法載入網頁: ${url}`);
                return res.text();
            })
        );

        const htmlTexts = await Promise.all(htmlPromises);

        // 5. 解析每個網頁裡面的 .group-container
        htmlTexts.forEach(htmlText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const groups = doc.querySelectorAll('.group-container');
            
            groups.forEach(group => {
                const groupQuestions = extractQuestionsFromGroup(group);
                allQuestions = allQuestions.concat(groupQuestions);
            });
        });

    } catch (error) {
        console.error('抓取子分類測驗失敗：', error);
    }
	
	return allQuestions;
}

/**
 * 點擊「開始綜合測驗」按鈕時觸發
 * @param {Element} btnElement - 被點擊的按鈕元素
 * @param {number} [limit=20] - 隨機抽取的題數，預設 20
 */
async function startCategoryQuizFromButton(btnElement, limit = 20) {
    // 1. 往上尋找最近的 li.cat-card 作為範圍
    const cardElement = btnElement.closest('.cat-card');
    if (!cardElement) return;

	let textContent = btnElement.textContent;
    // 按鈕加入載入中狀態（可選）
    btnElement.disabled = true;
    btnElement.textContent = '載入題目中...';

    try {
		let allQuestions = await getCategoryQuizFromButton(cardElement);

		btnElement.disabled = false;
		btnElement.textContent = textContent;
        if (allQuestions.length === 0) {
            alert('在這些子分類網頁中找不到任何題目！');
            return;
        }
		
		// 2. 抓取分類名稱
		const nameSpan = cardElement.querySelector('.cat-card__name');
		const groupName = nameSpan ? nameSpan.textContent.trim() : '綜合測驗';

        // 6. 呼叫共用的測驗初始化與跳轉函數
        initAndRedirectQuiz(allQuestions, groupName, limit, true);

    } catch (error) {
        console.error('抓取子分類測驗失敗：', error);
        alert('讀取網頁失敗，請確認網頁路徑是否正確，以及是否透過伺服器 (如 Live Server) 執行。');
        btnElement.disabled = false;
        btnElement.textContent = '開始綜合測驗';
    }
}

/**
 * 啟動測驗並傳遞複數檔案名稱到 exam.html
 * @param {string|string[]} fileNames - 單一檔名或檔名陣列 (例如: ["file1.txt", "file2.txt"])
 * @param {number} questionCount - 題目數量限制
 */
async function startCategoryQuizFromButtonWithFile(fileNames, questionCount, isIndex=false, startQ=0, isRandom=true, filter=null) {
    if (!fileNames) {
        alert('找不到檔案名稱！');
        return;
    }

    // 確保傳進來的檔名是陣列格式，如果只是單個字串就把它包成陣列
    const filesArray = Array.isArray(fileNames) ? fileNames : [fileNames];

    if (filesArray.length === 0) {
        alert('請至少選擇一個檔案！');
        return;
    }

	await loadQuizFiles(JSON.stringify(filesArray), questionCount || '', isIndex, startQ, isRandom, filter);
}

function parserOption(op, an) {
	if (!op || !Array.isArray(op) || op.length === 0) return '';

	// 💡 動態產生 A-Z 的前綴陣列 (支援到 26 個選項)
	const upperAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let optionsHtml = '';

	for (let i = 0; i < op.length; i++) {
		const prefix = i < upperAlphabet.length ? `${upperAlphabet[i]}. ` : `${i + 1}. `;
		// 將選項內容中的 \n 轉換為 <br>
		const opText = op[i] ? op[i].replace(/\n/g, '<br>') : '';
		optionsHtml += `<div class="option">${prefix}${opText}</div>`;
	}

	let answerHtml = '';
	if (an !== undefined && an !== null) {
		// 💡 動態將數字對應回 A-Z（若大於 26 則直接顯示數字本身）
		let mappedAn = an;
		if (typeof an === 'number' && an >= 1 && an <= upperAlphabet.length) {
			mappedAn = upperAlphabet[an - 1];
		}
		answerHtml = `<div class="answer">正解：${mappedAn}</div>`;
	}

	return optionsHtml + answerHtml;
}

function parserContent(content) {
	if (!content) return '';

	const optionHtml = parserOption(content.op, content.an);
	// 將題目 (q) 中的 \n 轉換為 <br>
	const questionText = content.q ? content.q.replace(/\n/g, '<br>') : '';
	
	// 處理解析 (al)：取代 \n 為 <br>，並將 [1]~[4] 轉換為 [A]~[D]
	let analysisText = '';
	if (content.al) {
		let processedAl = content.al.replace(/\n/g, '<br>');

		// 💡 支援到 Z：動態將 [1] ~ [26] 轉換為 [A] ~ [Z]，並加上換行
		const upperAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		for (let i = 0; i < upperAlphabet.length; i++) {
			const numTag = `[${i + 1}]`;
			const letterTag = `<br>[${upperAlphabet[i]}]`;
			
			// 使用全域取代，將所有的 [1] 換成 <br>[A]，以此類推
			processedAl = processedAl.split(numTag).join(letterTag);
		}
			
		analysisText = `<div class="analysis">${processedAl}</div>`;
	}

	return `${questionText}<br>${optionHtml}${analysisText}`;
}
		
function parserJson(text, groupName){
	const jsonArray = JSON.parse(text);
	if (!Array.isArray(jsonArray)) {
		alert('JSON 格式錯誤：根節點必須是 Array');
		return;
	}

	// 1. 建立 cards 陣列
	const cards = jsonArray.map((item, index) => {
		return {
			cardIndex: index,
			jaContent: parserContent(item.ja),
			zhContent: parserContent(item.zh),
			termTitle: item.ja.ca ?? "",
			groupName: item.ja.ti ?? groupName
		};
	});
	
	return cards;
}
		
function utilGotoQuiz(finalQuestions, groupName, startQ, isRandom, isIndex=false){
	// 將題庫與群組資訊存到 localStorage
	localStorage.setItem('quizQuestions', JSON.stringify(finalQuestions));
	localStorage.setItem('quizGroupName', groupName);
	localStorage.setItem('quizScore', '0');
	localStorage.setItem('quizTotal', '0');

	// 組裝 GET 參數
	params = new URLSearchParams({
		start: startQ,
		random: isRandom
	});
	
	if(isRandom)
		params = "";
	else
		params =  "?" + params.toString();


    // 跳轉到測驗頁面
	if(isIndex)
		window.location.href = 'quiz.html'+params;
	else
		window.location.href = '../quiz.html'+params;
}


async function loadQuizFiles(filesJson, questionCount, isIndex=false, startQ=0, isRandom=true, filter=null)
{
	if (!filesJson) {
		return;
	}

	// 將字串還原為陣列
	const fileNames = JSON.parse(filesJson);

	console.log(`準備載入以下 ${fileNames.length} 個題庫檔案：`, fileNames);

	try {
		const maxConcurrent = 5;
		const results = new Array(fileNames.length);

		async function loadFile(index) 
		{
			const fileName = fileNames[index];
			let filePath = `exam/${fileName}.txt`;
			if (!isIndex) {
				filePath = "../" + filePath;
			}

			const res = await fetch(filePath);
			if (!res.ok) {
				throw new Error(`無法載入檔案: ${fileName}`);
			}

			const text = await res.text();

			return parserJson(text, fileName);
		}


		// 分批處理
		for (let i = 0; i < fileNames.length; i += maxConcurrent) 
		{
			const batch = [];
			for (
				let j = i;
				j < Math.min(i + maxConcurrent, fileNames.length);
				j++
			) {
				batch.push(
					loadFile(j).then(result => {
						results[j] = result;
					})
				);
			}

			await Promise.all(batch);

			console.log(`已完成 ${Math.min(i + maxConcurrent, fileNames.length)} / ${fileNames.length}`);
		}

		// 3. 將所有檔案的題目合併成同一個大陣列
		let allQuizList = [];
		results.forEach(data => {
			if (Array.isArray(data)) {
				allQuizList = allQuizList.concat(data);
			}
		});

		console.log(`成功合併題庫！總題數：${allQuizList.length}`);
		
		if(filter){
			allQuizList = allQuizList.filter(item => {
				if (!item.termTitle) return false;
				
				// 透過 「 » 」 將字串分割成陣列
				const parts = item.termTitle.split(" » ");
				
				// 檢查是否有第三個元素 (index 為 2，因為陣列從 0 開始算)
				if (parts.length < 3) return false;
				
				const targetText = parts[2].trim();
				
				// 將 filter 用 | 分割成多個允許的條件陣列
				const allowedFilters = filter.split("|");
				
				// 檢查 parts[2] 是否符合 allowedFilters 其中之一
				return allowedFilters.some(keyword => targetText.includes(keyword.trim()));
			});
			console.log(`成功篩選題庫！總題數：${allQuizList.length}`);
		}
		
		// 5. 初始化你的題庫與畫面 (請對接你原本的測驗初始化函式)
		// 使用 Fisher-Yates 演算法將所有題目隨機打亂（洗牌）
		let shuffledCards = [...allQuizList];
		for (let i = shuffledCards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
		}

		// 取得最大可用題目數（防止要求數量大於總題數）
		const actualCount = Math.min(questionCount, shuffledCards.length);
		const finalQuestions = shuffledCards.slice(0, actualCount);

		const groupNames = fileNames[0]

		utilGotoQuiz(finalQuestions, groupNames, startQ, isRandom, isIndex);

	} catch (error) {
		console.error("載入多個題庫失敗:", error);
		alert(`載入題庫失敗: ${error.message}`);
	}
}