<div align="center">
    <img src="https://raw.githubusercontent.com/bytedance/xgplayer/master/xgplayer.png" width="384" height="96">
</div>
<div align="center">
    <a href="https://www.npmjs.com/package/xgplayer" target="_blank">
        <img src="https://img.shields.io/npm/v/xgplayer.svg" alt="npm">
    </a>
    <a href="https://www.npmjs.com/package/xgplayer">
        <img src="https://img.shields.io/npm/dm/xgplaer.svg" alg="download">
    </a>
    <a href="https://www.npmjs.com/package/xgplayer" target="_blank">
        <img src="https://img.shields.io/npm/l/xgplayer.svg" alt="license">
    </a>
    <a href="http://commitizen.github.io/cz-cli/">
        <img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="commitizen">
    </a>
</div>


### 官方概述
[西瓜官方文档](http://h5player.bytedance.com/)


### 魔改说明
因业务需要特基于西瓜播放器源代码基础上进行魔改，使其支持ws-flv协议。后续考虑在此基础上再添加其他解码功能。使用方法与官方保持一致。
flv插件自行打包安转自己项目中 

ws-flv示例页面 (https://github.com/youxiuchen/xgplayerpro/edit/main/fixtures/flv/index.html)

页面调试

```
yarn 
yarn build:flv
以服务形式打开flv示例页面

```

```
// 打包flv插件
 执行  yarn build
选择 xgplayer-flv


// 项目中引入
import FlvPlayer from 'xgplayer-flv插件路径'


//使用

new window.Player({
          id: 'mse',
          isLive: true,
          playsinline: true,
          url: 'http://127.0.0.1:8081/live/liveStream.flv',
          autoplay: true,
          height: window.innerHeight,
          width: window.innerWidth,
          plugins: [window.FlvPlayer]
      })
```



