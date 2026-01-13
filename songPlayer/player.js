// 等待DOM完全加载
document.addEventListener('DOMContentLoaded', function () {
    // 计算基路径
    const basePath = window.location.pathname.includes('songPlayer')
        ? window.location.pathname.split('/songPlayer')[0] + '/songPlayer/'
        : './';

    const songsDir = `${basePath}songs/`;
    const imagesDir = `${basePath}images/`;

    // GitHub Pages 路径验证日志
    console.log('GitHub Pages 路径验证：');
    console.log('basePath:', basePath);
    console.log('imagesDir:', imagesDir);
    console.log('当前页面URL:', window.location.href);
    console.log('仓库名是否匹配:', window.location.pathname.includes('studyEN'));

    console.log('初始化播放器...');
    console.log('Base path:', basePath);
    console.log('Songs dir:', songsDir);
    console.log('Images dir:', imagesDir);

    // 获取DOM元素
    const getEl = (id) => {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`错误: 未找到ID为"${id}"的元素`);
        }
        return el;
    };

    const els = {
        playerView: getEl('player-view'),
        bg: getEl('bg'),
        songIndex: getEl('song-index'),
        switchSong: getEl('switch-song'),
        totalCount: getEl('total-count'),
        cover: getEl('current-cover'),
        title: getEl('song-title'),
        singer: getEl('song-singer'),
        playPause: getEl('play-pause'),
        prev: getEl('prev'),
        next: getEl('next'),
        mode: getEl('mode'),
        progress: getEl('progress'),
        volume: getEl('volume'),
        currentTime: getEl('current-time'),
        totalTime: getEl('total-time'),
    };

    // 检查关键元素是否存在
    console.log('检查DOM元素:');
    console.log('cover元素:', els.cover);
    console.log('bg元素:', els.bg);
    console.log('title元素:', els.title);

    // 如果cover元素不存在，创建一个
    if (!els.cover) {
        console.log('cover元素不存在，正在创建...');
        const coverWrap = document.querySelector('.cover-wrap');
        if (coverWrap) {
            const img = document.createElement('img');
            img.id = 'current-cover';
            img.alt = '专辑封面';
            coverWrap.appendChild(img);
            els.cover = img;
            console.log('已创建cover元素:', els.cover);
        } else {
            console.error('错误: 未找到.cover-wrap容器');
        }
    }

    const audio = new Audio();
    const state = {
        playlist: [],
        index: 0,
        mode: 'loop', // loop | shuffle | single
    };

    // 初始化
    init();

    async function init() {
        await loadSongs();
        bindEvents();

        // 设置音量初始值
        audio.volume = 0.5;
        if (els.volume) els.volume.value = 0.5;

        // 默认加载第一首歌
        if (state.playlist.length > 0) {
            loadSong(0);
            updateIndexControls();
        } else {
            console.error('播放列表为空，请检查songs文件夹和songs.json文件');
        }
    }

    function bindEvents() {
        if (els.switchSong) els.switchSong.addEventListener('click', switchSongByIndex);
        if (els.songIndex) els.songIndex.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') switchSongByIndex();
        });

        if (els.playPause) els.playPause.addEventListener('click', togglePlay);
        if (els.prev) els.prev.addEventListener('click', () => playPrev());
        if (els.next) els.next.addEventListener('click', () => playNext());
        if (els.mode) els.mode.addEventListener('click', switchMode);
        if (els.progress) els.progress.addEventListener('input', onSeek);
        if (els.volume) els.volume.addEventListener('input', () => {
            audio.volume = parseFloat(els.volume.value);
        });

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateTime);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', () => {
            if (els.cover) els.cover.classList.add('cover-rotating');
            if (els.playPause) els.playPause.textContent = '⏸';
        });
        audio.addEventListener('pause', () => {
            if (els.cover) els.cover.classList.remove('cover-rotating');
            if (els.playPause) els.playPause.textContent = '▶';
        });

        audio.addEventListener('error', (e) => {
            console.error('音频加载错误:', e);
        });
    }

    async function loadSongs() {
        try {
            console.log('正在加载歌曲列表...');
            const res = await fetch(`${songsDir}songs.json`);
            if (!res.ok) throw new Error(`无法加载 songs.json: ${res.status}`);

            const songsData = await res.json();
            console.log('从 songs.json 读取到的歌曲数据:', songsData);

            // 构建播放列表 - 支持两种格式：简单文件名数组或带详细信息的对象数组
            if (Array.isArray(songsData)) {
                state.playlist = songsData.map(item => {
                    // 如果是字符串，视为文件名
                    if (typeof item === 'string') {
                        return parseSongFromFilename(item);
                    }
                    // 如果是对象，使用提供的信息
                    else if (typeof item === 'object' && item.file) {
                        return {
                            file: item.file,
                            base: item.file.replace(/\.[^/.]+$/, ""),
                            title: item.title || item.file.replace(/\.[^/.]+$/, ""),
                            singer: item.singer || "未知歌手",
                            audioUrl: `${songsDir}${item.file}`,
                        };
                    }
                    return null;
                }).filter(Boolean); // 过滤无效项
            }

            console.log('构建的播放列表:', state.playlist);

        } catch (error) {
            console.error('加载歌曲列表失败:', error);
            state.playlist = [];
        }
    }

    // 从文件名解析歌曲信息的辅助函数
    function parseSongFromFilename(file) {
        const base = file.replace(/\.[^/.]+$/, ""); // 去掉扩展名

        // 尝试多种分隔符解析歌手和歌名
        const separators = ['-', '_', '–', '—']; // 包含各种连字符和下划线
        let title = base;
        let singer = "未知歌手";

        for (const sep of separators) {
            const parts = base.split(sep).map(part => part.trim());
            if (parts.length >= 2) {
                // 常见格式: "歌手 - 歌名" 或 "歌名 - 歌手"
                // 简单判断：较短的部分更可能是歌手名
                if (parts[0].length <= parts[1].length) {
                    singer = parts[0];
                    title = parts.slice(1).join(sep);
                } else {
                    title = parts[0];
                    singer = parts.slice(1).join(sep);
                }
                break; // 找到第一个有效分隔符后停止
            }
        }

        return {
            file,
            base,
            title,
            singer,
            audioUrl: `${songsDir}${file}`,
        };
    }

    function updateIndexControls() {
        if (els.totalCount) els.totalCount.textContent = `/ ${state.playlist.length}`;
        if (els.songIndex) {
            els.songIndex.max = state.playlist.length;
            els.songIndex.value = state.index + 1;
        }
    }

    function switchSongByIndex() {
        if (!els.songIndex) return;
        const index = parseInt(els.songIndex.value) - 1;
        if (index >= 0 && index < state.playlist.length) {
            state.index = index;
            loadSong(index);
            play();
        } else {
            alert(`请输入 1-${state.playlist.length} 之间的数字`);
        }
    }

    async function loadSong(i) {
        if (i < 0 || i >= state.playlist.length) {
            console.error('索引超出范围');
            return;
        }

        const item = state.playlist[i];
        console.log(`加载歌曲 ${i + 1}/${state.playlist.length}:`, item.title);

        try {
            // 暂停当前音频
            audio.pause();

            // 加载新音频
            audio.src = item.audioUrl;
            audio.load();

            // 更新UI
            if (els.title) els.title.textContent = item.title;
            if (els.singer) els.singer.textContent = item.singer;

            // 加载封面图片
            await loadCoverImage(item);

            // 更新索引显示
            updateIndexControls();

            console.log('歌曲加载完成:', item.audioUrl);

        } catch (error) {
            console.error('加载歌曲失败:', error);
        }
    }

    async function loadCoverImage(item) {
        if (!item) {
            console.error('loadCoverImage: item为空');
            return;
        }

        const songName = item.base;
        const extensions = ['png', 'jpg'];
        const imageUrls = extensions.map(ext => `${imagesDir}${songName}.${ext}`);

        // 图片加载Promise
        function tryLoad(url) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({success: true, url});
                img.onerror = () => resolve({success: false, url});
                img.src = url;
            });
        }

        // 依次尝试加载封面图片
        for (const imageUrl of imageUrls) {
            const result = await tryLoad(imageUrl);
            if (result.success) {
                if (els.cover) els.cover.src = imageUrl;
                if (els.bg) els.bg.style.backgroundImage = `url("${imageUrl}")`;
                return true;
            }
        }

        // 默认图片支持 png 和 jpg
        const defaultExtensions = ['png', 'jpg'];
        for (const ext of defaultExtensions) {
            const defaultUrl = `${imagesDir}default.${ext}`;
            const defaultResult = await tryLoad(defaultUrl);
            if (defaultResult.success) {
                if (els.cover) els.cover.src = defaultUrl;
                if (els.bg) els.bg.style.backgroundImage = `url("${defaultUrl}")`;
                return false;
            }
        }

        // 都失败则清空
        if (els.cover) els.cover.src = '';
        if (els.bg) els.bg.style.backgroundImage = '';
        return false;
    }

    function togglePlay() {
        if (audio.paused) {
            play();
        } else {
            pause();
        }
    }

    function play() {
        audio.play().catch(error => {
            console.error('播放失败:', error);
        });
    }

    function pause() {
        audio.pause();
    }

    function playPrev() {
        if (state.playlist.length === 0) return;

        if (state.mode === 'shuffle') {
            state.index = randIndex();
        } else if (state.mode === 'single') {
            // 单曲模式保持不变
        } else {
            state.index = (state.index - 1 + state.playlist.length) % state.playlist.length;
        }
        loadSong(state.index);
        play();
    }

    function playNext() {
        if (state.playlist.length === 0) return;

        if (state.mode === 'shuffle') {
            state.index = randIndex();
        } else if (state.mode === 'single') {
            // 单曲模式保持不变
        } else {
            state.index = (state.index + 1) % state.playlist.length;
        }
        loadSong(state.index);
        play();
    }

    function randIndex() {
        const n = state.playlist.length;
        if (n <= 1) return 0;
        let r;
        do {
            r = Math.floor(Math.random() * n);
        } while (r === state.index);
        return r;
    }

    function switchMode() {
        if (!els.mode) return;

        const modes = [
            {key: 'loop', label: '循环'},
            {key: 'shuffle', label: '随机'},
            {key: 'single', label: '单曲'}
        ];

        const currentIndex = modes.findIndex(mode => mode.key === state.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        state.mode = modes[nextIndex].key;
        els.mode.textContent = modes[nextIndex].label;

        console.log(`切换播放模式为: ${state.mode}`);
    }

    function onSeek() {
        if (!audio.duration) return;
        const pct = parseFloat(els.progress.value) / 100;
        audio.currentTime = audio.duration * pct;
    }

    function updateTime() {
        const cur = audio.currentTime || 0;
        const dur = audio.duration || 0;
        if (els.currentTime) els.currentTime.textContent = fmt(cur);
        if (els.totalTime) els.totalTime.textContent = dur ? fmt(dur) : '00:00';
        if (els.progress) els.progress.value = dur ? Math.floor((cur / dur) * 100) : 0;
    }

    function onEnded() {
        if (state.mode === 'single') {
            audio.currentTime = 0;
            play();
        } else {
            playNext();
        }
    }

    function fmt(sec) {
        if (isNaN(sec)) return '00:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
});

// 折叠/展开 index-controls
document.addEventListener('DOMContentLoaded', function () {
    const indexControls = document.getElementById('index-controls');
    const toggleBtn = document.getElementById('toggle-index-controls');
    if (indexControls && toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            indexControls.classList.toggle('collapsed');
        });
    }
});