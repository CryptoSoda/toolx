// ==UserScript==
// @name         ToolX
// @namespace    http://tampermonkey.net/
// @version      2024-12-22
// @description  Небольшой скрипт, который добавляет чуток функционала на популярные платформы.
// @author       Ололоша
// @match        https://dexscreener.com/*
// @match        https://neo.bullx.io/*
// @match        https://gmgn.ai/*
// @match        https://app.virtuals.io/*
// @match        https://fun.virtuals.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=dexscreener.com
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant    GM.openInTab
// @grant    GM.setValue
// @grant    GM.notification
// @grant    GM.getValue
// ==/UserScript==
// START: init.js-------------------------------------------------------

// сообщать ли о новых монетах звуковым сигналом
const ALERT_NEW_COIN = true;

// тип уведомления - аудио или уведомление
const ALERT_NEW_COIN_TYPE = 'audio'; // поставьте notification для уведомлений

// для мемескопа с колонками (где 3 колонки) - если включено отслеживание, будет отслеживать только эти колонки. к примеру [ 2,3 ] наблюдать только за второй и третьей
const DASHBOARD_COLUM_WATCH = [2,3];

const API_KEY ='test';
const API_HOST = 'cryptochart.local';

// добавление графиков для монет (если апи подключено)
const ADD_CHARTS = false;
// быстрые клавиши активны
const ADD_HOTKEYS = true;

// добавление расширенной инфы - оценка по твиттеру, ранг создателя монеты и т.п ,
const ADD_COIN_INFO = false;

// добавление информации о коллерах и ботах, которые зашли в монету, согласно настройкам
const ADD_COLL_INFO = false;
// Если включено ADD_COLL_INFO скрывать высокорисковые монеты с большим процентом ботов/скамных коллеров
const AUTOHIDE_BY_COLL_INFO = false;

// аудио если надо
let audio_src = "https://www.fesliyanstudios.com/play-mp3/2390";

// стили, которые будут добавлены. Менять тут
const STYLE_NEW_COIN = '  background: #0b2d00 !important; ';


// быстрые клавиши работы (осторожно вводите данные в формы)
// Работает на дашборде (если зажать клавишу) и на странице монеты
//
let HOTKEYS={
    // показать скрытые монеты
    RESET_HIDE_COINS:'r',

    // отметить все монеты на странице как неновые
    UNCHEK_NEW_COINS:'q',
    // включить / выключить отслеживание дашборда
    DASHBOARD_ADD_TOOLS:'p',

    // поиск в твиттере токена
    COINPAGE_OPEN_SEARCH_TWITTER_TOKET: '1',
    COINPAGE_OPEN_SEARCH_TWITTER_TOKET_CURRENTPAGE: '!',
    // поиск в debank.com страницы создателя
    COINPAGE_OPEN_CREATOR_DEBANK: '2',
    COINPAGE_OPEN_CREATOR_DEBANK_CURRENTPAGE :'@',

    // Only Solana
    COINPAGE_OPEN_CREATOR_PUMPFUN: '2',
    COINPAGE_OPEN_CREATOR_PUMPFUN_CURRENTPAGE: '@',

    // RAGPAGE Only Solana
    COINPAGE_OPEN_RAGPAGE: '3', //
    COINPAGE_OPEN_RAGPAGE_CURRENTPAGE: '#',

    //
   // COINPAGE_OPEN_PRETOKEN :'3',

    // открыть монету в терминале
    GOTO_BULLX: 'x',
    GOTO_GMGN: 'c',
    GOTO_MEVX: 'v',

    // удалить монету
    HIDECOIN: 'z'

};


// @todo проверка загрузки страницы при роутинге

// END: init.js-------------------------------------------------------
// START: ToolX.js-------------------------------------------------------
let ToolX = {

    audio: null,
    coins: {},
    apitrade :null,
    coins_hidden: {},
    keyPress: false,
    service: null,
    api: null,
    keydownEvent: null,

    init: function () {

        //
        unsafeWindow.document.addEventListener("keydown", (e) => {

            console.log('keydown', e.keyCode);
            ToolX.keydownEvent = e;
            if (e.keyCode >= 49 && e.keyCode <= 90) {
                ToolX.keyPress = e.keyCode;
            }

            if (e.key === HOTKEYS.RESET_HIDE_COINS) {
                ToolX.coins_hidden = {}
                GM.setValue('coins_hidden', JSON.stringify(ToolX.coins_hidden))
                alert('Очистили coins_hidden');
                unsafeWindow.location = unsafeWindow.location + ''

            }
        });

        unsafeWindow.document.addEventListener("keyup", (e) => {
            console.log('keyup', e.keyCode);

            if (e.keyCode === ToolX.keydownEvent.keyCode) {
                ToolX.keydownEvent = false;
                ToolX.keyPress = false
            }
        });
        unsafeWindow.document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                if (ToolX.keydownEvent !== false) {
                    ToolX.keydownEvent = false;
                    ToolX.keyPress = false
                }
            }
        });


        GM.getValue('coins_hidden').then((coins_hidden_history) => {
            console.log('Скрытых монет', coins_hidden_history);
            if (coins_hidden_history) {
                coins_hidden_history = JSON.parse(coins_hidden_history)
                let time = new Date().getTime()
                for (let coin_hidden in coins_hidden_history) {
                    if ((time - coins_hidden_history[coin_hidden].t) > 60000 * 60) {
                        delete coins_hidden_history[coin_hidden]
                    }
                }

                ToolX.coins_hidden = coins_hidden_history
            }
            GM.setValue('coins_hidden', JSON.stringify(ToolX.coins_hidden))
        });
    },
    href: null,


    run: function () {

        if (ALERT_NEW_COIN && ALERT_NEW_COIN_TYPE ==='audio') {
            ToolX.audio = new Audio(audio_src);
        }

        ToolX.apitrade = new ApiTrade(API_KEY, API_HOST);

        switch (unsafeWindow.location.hostname) {
            case 'neo.bullx.io':
                ToolX.service = new BullX()
                break;
            case 'dexscreener.com':
                ToolX.service = new DexScreener()
                break;
            case 'gmgn.ai':
                ToolX.service = new Gmgn()
                break;
            case 'app.virtuals.io':
            case 'fun.virtuals.io':
                ToolX.service = new Virtuals()
                break;


            default:
                alert('Service not found!');
                return 1;
                break;
        }

        ToolX.service.run()

    },

    hideCoin(pairAddress) {
        ToolX.coins_hidden[pairAddress] = {
            t: new Date().getTime()
        }
        delete ToolX.coins[pairAddress]

        GM.setValue('coins_hidden', JSON.stringify(ToolX.coins_hidden))

    },
    alertNewCoin: function (new_coins) {

        if (ALERT_NEW_COIN_TYPE ==='audio') {

            try {
                ToolX.audio.muted = false;
                ToolX.audio.play()
            }catch (e) {
                // В фоне хром очень хреново проигрывает
            }
        }else if(ALERT_NEW_COIN_TYPE ==='notification'){
            GM.notification('New Coin');
        }else{
            alert('Error audioPlay bad Type!');
        }


    },

    apiTraders: function (chain, coins, callbackCoin) {

        ToolX.apitrade.getCoinInfo(chain, coins, (info)=>{
            for (let i in info) {
                let coin_info = info[i]
                if (coin_info.chart === undefined || coin_info.chart.status !== 'ok') {
                    continue;
                }
                callbackCoin(coin_info)
            }
        });
    },

    ///////
    ///////
    _KeydownEvents: [],

    addKeydownEventListener: function (callback) {
        ToolX._KeydownEvents.push((e) => {
            callback(e)
        })
        unsafeWindow.document.addEventListener("keydown", ToolX._KeydownEvents[ToolX._KeydownEvents.length - 1]);
    },

    removeKeydownEvents: function (callback) {
        for (let i in ToolX._KeydownEvents) {
            unsafeWindow.document.removeEventListener("keydown", ToolX._KeydownEvents[i])
        }
    }

}

// END: ToolX.js-------------------------------------------------------
// START: ToolXService.js-------------------------------------------------------


class ToolXService {

    styles = ''

    constructor() {

        this.initStyle()

    }


    initStyle() {
        let css = unsafeWindow.document.createElement('style');
        css.type = 'text/css';
        css.appendChild(unsafeWindow.document.createTextNode(this.styles));
        unsafeWindow.document.getElementsByTagName("head")[0].appendChild(css);
    }

    searchNewCoins() {
        // NEED TO OVERRIDE
    }

    /**
     * @param coin
     * @param coin_info
     * @param coin_info.coin
     * @param coin_info.chart.image
     */
    getTradesCoinResponse(coin, coin_info) {
        // NEED TO OVERRIDE
    }

    /**
     * @param coin_info
     * @param coin_info.coin
     * @param coin_info.chart.image
     */
    getTradesResponse(coin_info) {

        for (let ii in ToolX.coins) {
            if (ToolX.coins[ii].coin === coin_info.coin) {
                ToolX.coins[ii].coin_info = coin_info

                this.getTradesCoinResponse(ToolX.coins[ii], coin_info)
            }
        }
    }

    searchNewCoinsTimer = null
    getTradesTimer = null

    routers = {}

    current_router= null

    _KeydownEvents=[]
    // стандартный запуск плагина
    addKeydownEventListener(callback){
        this._KeydownEvents.push((e) => {
            callback(e)
        })

        unsafeWindow.document.addEventListener("keydown", this._KeydownEvents[this._KeydownEvents.length-1] );
    }

    removeKeydownEvents(callback){
        for(let i in this._KeydownEvents){
            unsafeWindow.document.removeEventListener("keydown", this._KeydownEvents[i])
        }
        this._KeydownEvents = []
    }

    route(){
        let location = unsafeWindow.location + '';
        this.current_router = null

        for (let rule in this.routers) {
            let r = new RegExp(rule);
            console.log(r, location,r.test(location) )
            if (r.test(location)) {
                this.current_router = [rule, this.routers[rule]];
                console.log('Action:' + this.constructor.name + '.' + this.routers[rule]);
                this[this.routers[rule]]();
                break;
            }
        }
    }

    _timers=[]

    run() {

        this.route()

        // запуск отлеживания измнения урла (пости у всех сайтов оно без обновления страницы)
        let _this = this;


        let timer = setInterval(() => {

            try{
                if(ToolX.href === null){
                    ToolX.href = window.location.href;
                }

                if (ToolX.href !== window.location.href) {
                    // alert change!
                    _this.stop()
                    _this.route()

                    //console.log('WINDOW LOCATION CHANGE', window);
                    //window.location =   window.location+'';
                    //
                    ToolX.href = window.location.href;
                }
            }catch (e) {
                console.log(e)
                clearInterval(timer)
            }

        }, 250);
    }
    // остановка палгина - удалить все таймеры/интервалы и слушатели
    stop(){
        this.removeKeydownEvents()

        for(let i in this._timers){
            if(this._timers[i][0]==='t'){
                clearTimeout(this._timers[i][1])
            }
            if(this._timers[i][0]==='i'){
                clearInterval(this._timers[i][1])
            }
        }
        this._timers = [];
    }




}


// функции по сбору и упращению
let CoinsAggregateMixin = Base => class extends Base {

    // страница с коинами, при нажатии на клавишу начинается отслеживание
    actionColumnsDefault() {
        let location =  unsafeWindow.location + '';
        this.addKeydownEventListener((e) => {
               if (e.key === HOTKEYS.DASHBOARD_ADD_TOOLS) {

                if(location.includes('?')){
                    unsafeWindow.location = unsafeWindow.location + '&TOOLX'
                }else{
                    unsafeWindow.location = unsafeWindow.location + '?TOOLX'
                }


            }
        });
    }


    // режим отслеживания
    actionColumns() {
        let _this = this
        let location =  unsafeWindow.location + '';
        this.addKeydownEventListener((e) => {

            if (e.key === HOTKEYS.DASHBOARD_ADD_TOOLS) {
                if(location.includes('TOOLX')){
                    unsafeWindow.location = location.replace(/TOOLX/, '')
               }
           }
        });

        let t = setTimeout(function () {
            _this.searchNewCoinsTimer = setInterval(function () {
                try {
                    _this.searchNewCoins();
                } catch (e) {
                    console.log(e)
                    alert( e.message ); // (3) <--
                    clearInterval(_this.searchNewCoinsTimer);
                    if (_this.getTradesTimer) {
                        clearInterval(_this.getTradesTimer);
                    }
                }

            }, 1000);

            _this._timers.push(['i', _this.searchNewCoinsTimer ])
            if (ADD_CHARTS) {
                // ф5 графиков
                _this.getTradesTimer = setInterval(function () {
                    _this.getTrades();
                }, 5000);
                _this._timers.push(['i', _this.getTradesTimer ])
            }
        }, 3000);

        this._timers.push(['t', t])
        //
        this.addKeydownEventListener((e) => {
            if (e.key === HOTKEYS.UNCHEK_NEW_COINS) {
                for (let pairAddress in ToolX.coins) {
                    ToolX.coins[pairAddress].is_new = false
                    for (let coll_id in ToolX.coins[pairAddress].dom_row) {
                        if (ToolX.coins[pairAddress].dom_row[coll_id].parentElement !== null) {
                            ToolX.coins[pairAddress].dom_row[coll_id].classList.remove("toolx_newcoin");
                        }
                    }
                }
            }}
        );

    }

    searchNewCoinsAction=null
    searchNewCoinsByAction(routers) {

        if (this.searchNewCoinsAction === null) {
            let location = window.location.href + '';
            for (let rule in routers) {


                let r = new RegExp(rule);

                console.log(r, location, r.test(location));
                if (r.test(location)) {
                    this.searchNewCoinsAction = routers[rule]
                    break;
                }
            }
            console.log('searchNewCoinsByAction',this.searchNewCoinsAction );
            if (this.searchNewCoinsAction === null) {
                throw new Error('searchNewCoinsByAction not found!');
            }
        }

        this[this.searchNewCoinsAction]();
    }

    // обработка каждого найденного коина, в соотв с его столбцом
    eachCoinsInPage(coll_id, row) {

        throw new Error('Need override');
    }

    // коин оказался новым
    eachCoinIsNew(coll_id, row, chain, pairAddress, coin){
        ToolX.coins[pairAddress] = {
            type: 'solana',
            pairAddress: pairAddress,
            coin: pairAddress,
            update_chart: 0,
            is_new: true,
            coin_info: null,
            dom_row: []
        }
        ToolX.coins[pairAddress].dom_row[coll_id] = row;
        // обработка строк
        row.classList.add("toolx_newcoin");

        this._addEventsToRow(pairAddress, row);
        this.count_new++;
    }

    // проверка коина
    eachCoinIsNotNew(coll_id, row, chain, pairAddress, coin){
        if (// пропал и снова показался
            (ToolX.coins[pairAddress].dom_row[coll_id] !== undefined
                && ToolX.coins[pairAddress].dom_row[coll_id].parentElement === null)
            ||
            // миграция, или просто сменил колонку, можно отрробовать по разному
            ToolX.coins[pairAddress].dom_row[coll_id] === undefined
        ) {
            ToolX.coins[pairAddress].dom_row[coll_id] = row
            //  row.classList.add("toolx_newmigratedcoin");
            if (ToolX.coins[pairAddress].is_new) {
                row.classList.add("toolx_newcoin");
            }
            this._addEventsToRow(pairAddress, row);

            // добавлем картинку если она есть
            if (ToolX.coins[pairAddress].coin_info !== null) {
                this.createChartForDom(row, ToolX.coins[pairAddress].coin_info)
            }
        }
    }



    // получение информации о графике
    getTrades() {

        // обновляем графики ра в МС
        let interval_update = 10000;
        let coins_list = [];
        let time = new Date().getTime()

        let iNotFoud = 0

        for (let i in ToolX.coins) {
            if (ToolX.coins[i].coin === false || ToolX.coins[i].coin === null || ToolX.coins[i].coin === '') {
                console.log('cannot update', ToolX.coins[i]);
                iNotFoud++
                continue;
            }
            if ((time - ToolX.coins[i].update_chart) < interval_update) {
                continue;
            }
            coins_list.push(ToolX.coins[i].coin)
        }
        if (coins_list.length === 0) {
            return 1;
        }
        if (iNotFoud > 0) {
            console.log('BD:', ToolX.coins)
        }
        // for test)
        if (coins_list.length > 2) {
            //   coins_list = coins_list.slice(0, 2)
        }
        let _this = this

        // пока только солана
        ToolX.apiTraders('sol', coins_list, (coin_info) => {
            _this.getTradesResponse(coin_info)
        })
    }


    // обновляем данные из апи - данные по монете, твиттеру, графики - если есть
    getTradesCoinResponse(coin, coin_info) {

        coin.update_chart = new Date().getTime()
        for (let i in coin.dom_row) {
            // элемент удалён!
            if (coin.dom_row[i].parentElement === null) {
                continue;
            }
            let dom_row = coin.dom_row[i]
            this.createChartForDom(dom_row, coin_info)
            //  console.log('update', coin);
        }

    }

    // создание картинки торгов, либо обновление данных
    createChartForDom(dom_row, coin_info) {
        if (coin_info.chart === undefined || !coin_info.chart.image) {
            return 1;
        }
        if (dom_row.querySelectorAll('.coin_image').length) {
            dom_row.querySelectorAll('.coin_image')[0].src = coin_info.chart.image + '&sizename=bullx';
        } else {

            // dom_row.style.setProperty("height", '300px');
            // a[data-sentry-element="ItemLink"] > div[data-sentry-element="Flex"]
            this.ChartDom(dom_row, coin_info)
        }
    }

    // удалить монеты которых уже нет на странице
    removeOldCoins() {
        let time = new Date().getTime()
        let interval_delete = 50000;
        for (let i in ToolX.coins) {
            if ((time - ToolX.coins[i].time) < interval_delete) {
                continue;
            }
            delete ToolX.coins[i]
        }
    }

    rowEventRemove(pairAddress, row) {
        // Z
        if (ToolX.key=== HOTKEYS.HIDECOIN) {
            ToolX.hideCoin(pairAddress)
            row.style.setProperty('display', 'none');
        }
    }


    EventRowUnsetNew(e, pairAddress, row){
        for (let coll_id in ToolX.coins[pairAddress].dom_row) {
            ToolX.coins[pairAddress].dom_row[coll_id].classList.remove("toolx_newcoin");
        }
        ToolX.coins[pairAddress].is_new = false;
    }

    EventRowDelete(e, pairAddress, row){
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            e.cancelBubble = true;

            ToolX.hideCoin(pairAddress)
            row.style.setProperty('display', 'none');
            return false
        }
    }


    _addEventsToRow(pairAddress, row) {

        let _this = this
        // стандартный клик мыши будет отмечать как помеченное
        row.addEventListener("mousedown", (e) => _this.EventRowUnsetNew(e, pairAddress, row));
        row.addEventListener('contextmenu', event => event.preventDefault());

        // удаление правой кнопкой
        row.addEventListener("mousedown",  (e)=> _this.EventRowDelete(e, pairAddress, row));

        // нам надо отключить поведение клика по ссылке. Это обычно либо этот элемент либо первая ссылка. Иначе надо переписать поиск
        let as = row.querySelectorAll('a');
        as = [...as]
        if(row.tagName==='A'){
            row.addEventListener("click", (e)=>{
                e.preventDefault();
                e.stopPropagation();
                _this.rowEventOpenTrade(pairAddress, row)
                _this.rowEventRemove(pairAddress, row)
                return false;
            } );
            as.shift()
        }

        // есть ссылки в самом блоке, если мы отключили события, они работать не будут
        for(let i in as){
            as[i].addEventListener("click", function (e) {

                e.preventDefault();
                e.stopPropagation();


                //
                let href = this.getAttribute('href')
                if(href[0]==='/' || href.includes(unsafeWindow.location.host+'' ) ){
                    _this.rowEventOpenTrade(pairAddress, row)
                    _this.rowEventRemove(pairAddress, row)

                    return false;
                }
                GM.openInTab(href, true);
                return false;
            });
        }

    }



    rowEventOpenTrade(pairAddress, row) {


        if (ToolX.coins[pairAddress].coin === undefined || ToolX.coins[pairAddress].coin === false || ToolX.coins[pairAddress].coin === '') {
            alert('not found address');
            return 1;
        }
        let coin = ToolX.coins[pairAddress].coin

        if(ADD_HOTKEYS && ToolX.keydownEvent !== null && ToolX.keydownEvent!== false){


            let key = ToolX.keydownEvent.key;

            switch (key) {
                case HOTKEYS.GOTO_BULLX: // solana
                    GM.openInTab('https://neo.bullx.io/terminal?chainId=1399811149&address=' + coin);
                    break
                case HOTKEYS.GOTO_GMGN: //
                    GM.openInTab('https://gmgn.ai/sol/token/' + coin);
                    break
                case HOTKEYS.GOTO_MEVX: //
                    GM.openInTab('https://mevx.io/solana/' + coin);
                    break


                case HOTKEYS.COINPAGE_OPEN_RAGPAGE:
                case HOTKEYS.COINPAGE_OPEN_RAGPAGE_CURRENTPAGE:

                    GM.openInTab('https://rugcheck.xyz/tokens/' + coin, key === HOTKEYS.COINPAGE_OPEN_RAGPAGE );

                    break;
                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET:
                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET_CURRENTPAGE:
                    GM.openInTab('https://x.com/search?q=' + coin, key === HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET );
                    break;

            }

        }
    }
};

//
let CoinMixin = Base => class extends Base {

    // страница коина
    actionCoinPage() {

    }

    CoinPageAddEvents(){
        let _this = this


        if(ADD_HOTKEYS)
        this.addKeydownEventListener((e) => {

            let coin = _this.current_token.coin
            let creator_address = _this.current_token.creator_address

            // на всякий случай защитимся от нормальных комбинаций
            if(e.ctrlKey === true){
                return 0
            }
            switch (e.key) {
                case HOTKEYS.COINPAGE_OPEN_RAGPAGE:
                case HOTKEYS.COINPAGE_OPEN_RAGPAGE_CURRENTPAGE:

                    GM.openInTab('https://rugcheck.xyz/tokens/' + coin, e.key === HOTKEYS.COINPAGE_OPEN_RAGPAGE );

                    break;
                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET:
                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET_CURRENTPAGE:
                    GM.openInTab('https://x.com/search?q=' + coin, e.key === HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET );
                    break;

                case HOTKEYS.COINPAGE_OPEN_CREATOR_PUMPFUN:
                case HOTKEYS.COINPAGE_OPEN_CREATOR_PUMPFUN_CURRENTPAGE:
                    GM.openInTab('https://pump.fun/profile/' + creator_address, e.key === HOTKEYS.COINPAGE_OPEN_CREATOR_PUMPFUN );
                    break;


                case HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK:
                case HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK_CURRENTPAGE:
                    GM.openInTab('https://debank.com/profile/' + creator_address, e.key === HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK );
                    break;
                case HOTKEYS.GOTO_BULLX:
                    GM.openInTab('https://bullx.io/terminal?chainId=1399811149&address=' + coin);
                    break
                case HOTKEYS.GOTO_GMGN:
                    GM.openInTab('https://gmgn.ai/sol/token/' + coin);
                    break
                case HOTKEYS.GOTO_MEVX:
                    GM.openInTab('https://mevx.io/solana/' + coin);
                    break
            }
        })
    }



};

// END: ToolXService.js-------------------------------------------------------
// START: Api.js-------------------------------------------------------


class Api {
     constructor() {


    }

    inet(url, callback){
        GM.xmlHttpRequest({
            method: "GET",
            url:url,
            withCredentials: true,
            onload: function (response) {
                let info = JSON.parse(response.responseText)
                callback(info)
            }
        });
    }
}


class ApiTrade extends Api{
    constructor(API_KEY, API_HOST) {
        super();

        this.API_KEY= API_KEY
        this.API_HOST= API_HOST
    }

    API_KEY = ''
    API_HOST = ''
    getCoinInfo  (chain, coins, callbackCoin) {

        let url = 'https://'+this.API_HOST+'/api.php?apikey='+this.API_KEY+'&action=coins_info&network=' + chain + '&coins=' + coins.join(',');

        console.log('API', url);

        this.inet(url, callbackCoin)
    }

}// END: Api.js-------------------------------------------------------
// START: BullX.js-------------------------------------------------------
class BullX extends CoinsAggregateMixin(CoinMixin(ToolXService)) {
    constructor() {
        super();

        this.routers['/terminal.+'] = 'actionCoinPage';

        //this.routers['pump-vision.+TOOLX'] = 'actionColumns';
       // this.routers['pump-vision'] = 'actionColumnsDefault';

         this.routers['bullx.io/\\?TOOLX'] = 'actionColumns';
         this.routers['bullx.io/$'] = 'actionColumnsDefault';

        this.routers['explore.+TOOLX'] = 'actionColumns';
        this.routers['explore'] = 'actionColumnsDefault';
    }



    initStyle() {
        this.styles = '.toolx_newcoin { ' + STYLE_NEW_COIN + ' }';

        super.initStyle();
    }

    current_token={}
    _tokenappData={}
    actionCoinPage() {

        let location = unsafeWindow.location.href + '';
        let coin = location.match(/&address=(.+?)(\?|$)/) //

        if (!coin) {
            alert('Coin not found!');
        }
        let chainId = location.match(/chainId=(\d+)/)[1]
        coin= coin[1]

        this.current_token = {
            coin: coin,
            creator_address: null,
        }
        let _this = this

        unsafeWindow.fetch( 'https://api-neo.bullx.io/v2/api/getTechnicalsV2', {

            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({"name":"getTechnicalsV2","data":{"tokenAddress":coin,"chainId":chainId}}) //JSON.stringify({a: 1, b: 'Textual content'})

        }).then(response => response.json())
            .then(function (result) {
                _this._tokenappData = result.data

                console.log(result);

                _this.current_token.creator_address =  result.data.devMakerData.address

                console.log(_this.current_token);
            })


        console.log(this.current_token);

        this.CoinPageAddEvents();

    }



    ChartDom(dom_row, coin_info) {
        dom_row.style.setProperty("height", '300px');
        let u = dom_row.querySelectorAll('.flex.overflow-hidden')[0]

        let div = unsafeWindow.document.createElement('div');
        div.style.setProperty('width', '500px');
        div.className = 'flex items-center justify-between border-b pb-2 border-grey-600';

        let img = unsafeWindow.document.createElement('img');
        img.src = coin_info.chart.image + '&sizename=bullx';
        img.className = 'coin_image';

        div.appendChild(img)
        u.appendChild(div)
    }

    getTrades() {
        super.getTrades()
    }

    searchNewCoinsFromMemescore() {

        let columns_o = unsafeWindow.document.querySelectorAll('main > div > div.grid > div')
        if (columns_o.length !== 3) {
            return 1;
            //throw new Error('Column not found!');
        }


        // монеты в разных колонках могут быть одинаковые.
        this.count_new = 0;
        let _this = this
        if (DASHBOARD_COLUM_WATCH.includes(1) )
            [...columns_o[0].querySelectorAll('.pump-card')].map((row) => _this.eachCoinsInPage(1, row));
        if (DASHBOARD_COLUM_WATCH.includes(2))
            [...columns_o[1].querySelectorAll('.pump-card')].map((row) => _this.eachCoinsInPage(2, row));
        if (DASHBOARD_COLUM_WATCH.includes(3))
            [...columns_o[2].querySelectorAll('.pump-card')].map((row) => _this.eachCoinsInPage(3, row));

        if (this.count_new && ALERT_NEW_COIN) {
            ToolX.alertNewCoin();
        }
        this.removeOldCoins()
        console.log('toolX new ', this.count_new);

    }

    searchNewCoinsFromExplore() {
        let rows = unsafeWindow.document.querySelectorAll('.b-table-row')
        if (!rows.length) {
            return 1;

            throw new Error('rows not found!');
        }
        //console.log(rows)


        this.count_new = 0;
        let _this = this
        rows = [...rows];
        rows.map((row) => _this.eachCoinsInPage2(1, row));

        if (this.count_new && ALERT_NEW_COIN) {
            ToolX.alertNewCoin();
        }
        this.removeOldCoins()
        console.log('toolX new ', this.count_new);
    }

    searchNewCoinsAction = null

    searchNewCoins() {

        this.searchNewCoinsByAction({
            'bullx.io/\\?TOOLX':  'searchNewCoinsFromMemescore',
            'explore': 'searchNewCoinsFromExplore'
        })


    }


    eachCoinsInPage(coll_id, row) {

        let row_html = row.innerHTML
        let pairAddress = row_html.match(/address=(.+?)"/, 'U')
        if (pairAddress === undefined) {
            throw new Error('error search coin!');
        }
        pairAddress = pairAddress[1];
        // удалённый
        if (ToolX.coins_hidden[pairAddress] !== undefined) {
            row.style.setProperty('display', 'none');
            return 1;
            //continue;
        }
        if (ToolX.coins[pairAddress] === undefined) {
            this.eachCoinIsNew(coll_id, row, 'solana', pairAddress, pairAddress)
        } else {
            //  проверяем, возможно коин пропадал и снова показался, либо он мог мигрировать, проверяем всё это
            this.eachCoinIsNotNew(coll_id, row, 'solana', pairAddress, pairAddress)
        }
        ToolX.coins[pairAddress].time = new Date().getTime()

    }
    eachCoinsInPage2(coll_id, row) {

        let row_html = row.getAttribute('href')
        let pairAddress = row_html.match(/address=(.+?)($|\?)/, 'U')
        if (pairAddress === undefined) {
            throw new Error('error search coin!');
        }
        pairAddress = pairAddress[1];
        // удалённый
        if (ToolX.coins_hidden[pairAddress] !== undefined) {
            row.style.setProperty('display', 'none');
            return 1;
            //continue;
        }
        if (ToolX.coins[pairAddress] === undefined) {
            this.eachCoinIsNew(coll_id, row, 'solana', pairAddress, pairAddress)
        } else {
            //  проверяем, возможно коин пропадал и снова показался, либо он мог мигрировать, проверяем всё это
            this.eachCoinIsNotNew(coll_id, row, 'solana', pairAddress, pairAddress)
       }
        ToolX.coins[pairAddress].time = new Date().getTime()

    }






    run() {
        super.run()
    }

}

// END: BullX.js-------------------------------------------------------
// START: DexScreener.js-------------------------------------------------------
 

class DexScreener extends CoinsAggregateMixin(CoinMixin(ToolXService)) {
    constructor() {
        super();

        this.routers['dexscreener.com/solana/.+'] = 'actionCoinPage';
      //  this.routers['dexscreener.com/new-pairs.+TOOLX'] = 'actionColumns';


        this.routers['TOOLX'] = 'actionColumns';
        this.routers['dexscreener.com/solana\?'] = 'actionColumnsDefault';

    }

    actionCoinPage() {




        this.current_token = {
            coin:  unsafeWindow.__SERVER_DATA.route.data.pair.pair.baseToken.address,
            creator_address: null,
        }

        if( unsafeWindow.__SERVER_DATA.route.data.pair.pair.launchpad !== undefined){
            this.current_token.creator_address =  unsafeWindow.__SERVER_DATA.route.data.pair.pair.launchpad.creator
        }
        let _this = this
        console.log(this.current_token);

        this.CoinPageAddEvents();
    }

    initStyle() {
        this.styles = '.toolx_newcoin .ds-table-data-cell{ ' + STYLE_NEW_COIN + ' }';
        super.initStyle();
    }


    ChartDom(dom_row, coin_info){
        let u = dom_row.querySelectorAll('.ds-table-data-cell')[0]
        u.style.setProperty("height", '100px');
        /**
         u.style.setProperty("height", '200px');
         let img =unsafeWindow.document.createElement('img');
         img.src = coin_info.chart.image;
         img.className  = 'coin_image';
         u.appendChild(img)


         u.innerHTML += '<div style="\
         position: absolute;\
         "><img src="' + coin_info.chart.image + '&sizename=dex" class="coin_image" "></div>';
         */
        let div = unsafeWindow.document.createElement('div');
        div.style.setProperty('position', 'absolute');
        div.className = '';

        let img = unsafeWindow.document.createElement('img');
        img.src = coin_info.chart.image + '&sizename=dex';
        img.className = 'coin_image';

        div.appendChild(img)
        u.appendChild(div)
    }



    dexScreenerPairs = null

    searchNewCoins() {

        if (this.dexScreenerPairs === null) {
            //  console.log('search!', unsafeWindow.__SERVER_DATA.route.data.dexScreenerData.pairs);
            this.dexScreenerPairs = {}
            // unsafeWindow.__SERVER_DATA.route.data.pairs
            let pairs = null
            if(unsafeWindow.__SERVER_DATA.route.data.dexScreenerData !== undefined ){
                pairs = unsafeWindow.__SERVER_DATA.route.data.dexScreenerData.pairs
            }else if(unsafeWindow.__SERVER_DATA.route.data.pairs !== undefined){
                pairs = unsafeWindow.__SERVER_DATA.route.data.pairs
            }else{
                throw new Error('__SERVER_DATA not found!');
            }


            for (let i in pairs) {
                let dc = unsafeWindow.__SERVER_DATA.route.data.pairs[i]
                this.dexScreenerPairs[dc.pairAddress.toLowerCase()] = {
                    pairAddress: dc.pairAddress,
                    coin: dc.baseToken.address,
                    chain: dc.chainId,
                    original: dc
                }
            }
        }

        let rows = unsafeWindow.document.querySelectorAll('.ds-dex-table-row')
        rows = [...rows];
        let count_new = 0;
        let is_updateDexScreenerPairs = false

        if(rows.length === 0){
            throw new Error('coins not found!');
        }

        for (let i in rows) {
            let row = rows[i]
            let row_html = row.innerHTML
            let pairAddress = row.getAttribute('href').match(/solana\/(.+)/)
            if (pairAddress === undefined) {
                throw new Error('error search coin!');
            }
            pairAddress = pairAddress[1];
            if (ToolX.coins_hidden[pairAddress] !== undefined) {
                row.style.setProperty('display', 'none');
                continue;
            }
            if (ToolX.coins[pairAddress] === undefined) {

                if (is_updateDexScreenerPairs === false) {
                    this.updateDexScreenerPairs()
                    is_updateDexScreenerPairs = true;
                }
                let coinRealAddr = this.getdexScreenerPairs(pairAddress)
                if (coinRealAddr === false) {
                 //   console.log('Error! coinRealAddr not found `' + pairAddress + '`');
                }

                ToolX.coins[pairAddress] = {
                    type: 'solana',
                    pairAddress: pairAddress,
                    coin: this.getdexScreenerPairs(pairAddress),
                    update_chart: 0,
                    dom_row: [row] // fix
                }

                // обработка строк
                row.classList.add("toolx_newcoin");

                this._addEventsToRow(pairAddress, row);
                count_new++;
            }

            ToolX.coins[pairAddress].time = new Date().getTime()
        }
        if (count_new && ALERT_NEW_COIN) {
            ToolX.alertNewCoin();
        }

        this.removeOldCoins()

        console.log('toolX new ', count_new);
        // this.getTrades()
    }



    _addEventsToRow(pairAddress, row) {

        let _this = this
        row.addEventListener("mousedown", (e)=> _this.EventRowUnsetNew(e, pairAddress, row));
        row.addEventListener('contextmenu', event => event.preventDefault());

        row.addEventListener("mousedown",  (e)=> _this.EventRowDelete(e, pairAddress, row));


        row.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("click!", this, ToolX.keyPress);

            _this.rowEventOpenTrade(pairAddress, row)

            _this.rowEventRemove(pairAddress, row)

            return false;
        });
    }

    _addEventsToRow_fix(pairAddress, row) {

        let _this = this
        row.addEventListener("mousedown", (e)=> _this.EventRowUnsetNew(e, pairAddress, row));
        row.addEventListener('contextmenu', event => event.preventDefault());

        // gmgn нормально не удаляет
        row.addEventListener("mousedown",  (e)=> _this.EventRowDelete(e, pairAddress, row));


        // gmgn.ai div.g-table-cell > a
        let hrefs= row.querySelectorAll('a')
        let f = function (e) {
            e.preventDefault();
            e.stopPropagation();

            _this.rowEventOpenTrade(pairAddress, row)
            _this.rowEventRemove(pairAddress, row)
            return false;
        }
        if(hrefs.length){
            hrefs[0].addEventListener("click",f );
        }
        if(row.tagName==='A'){
            row.addEventListener("click",f );
        }

    }



    _proxygetdexScreenerPairs = ''

    getdexScreenerPairs(pairAddress) {
        if (this.dexScreenerPairs[pairAddress] !== undefined) {
            return this.dexScreenerPairs[pairAddress].coin
        }
        let R = new RegExp('"pairAddress":"' + pairAddress + '","baseToken":\{"address":"(.*?)"', 'i')
        let m = R.exec(this._proxygetdexScreenerPairs)
//console.log("getdexScreenerPairs" , '"pairAddress":"'+coin+'","baseToken":\{"address":"(.*?)"', m, _proxygetdexScreenerPairs)
        if (m === null) {
            return false
        }
        return m[1];

    }

    updateDexScreenerPairs() {
        let DexScreener = this

        var s = unsafeWindow.fetch(unsafeWindow.location + '')
            .then(response => response.text())
            .then(function (result) {
                DexScreener._proxygetdexScreenerPairs = result;

                // обновляем все монеты, которые без реального адресса
                for (let pairAddress in ToolX.coins) {
                    if (ToolX.coins[pairAddress].coin === false) {
                        let coinRealAddr = DexScreener.getdexScreenerPairs(pairAddress)

                        if (coinRealAddr === false) {
                            console.log('Error! REALLY coinRealAddr not found `' + pairAddress + '`');
                        } else {
                            console.log('Update from fech ' + pairAddress + '`');
                            ToolX.coins[pairAddress].coin = coinRealAddr
                        }
                    }
                }

                console.log('Update fech COMLITED!', ToolX.coins);
            })
    }


}

// END: DexScreener.js-------------------------------------------------------
// START: Gmgn.js-------------------------------------------------------
class Gmgn extends CoinsAggregateMixin(CoinMixin(ToolXService)) {
    constructor() {
        super();

        this.routers['/token/.+'] = 'actionCoinPage';
        this.routers['gmgn.ai/meme/\?.+TOOLX'] = 'actionColumns';
        this.routers['gmgn.ai/meme/\?.+'] = 'actionColumnsDefault';

    }

    run() {

        this.route()

        // запуск отлеживания измнения урла (пости у всех сайтов оно без обновления страницы)
        let _this = this;

        let timer = setInterval(() => {

            try {


                if (ToolX.href === null) {
                    ToolX.href = window.location.href;
                }
                if (ToolX.href !== window.location.href) {

                    // https://gmgn.ai/sol/token/ ?tab=traders
                    let R = new RegExp('/token/.+?' + _this.current_token.coin + '')

                    if (this.current_router !== null && _this.current_router[1] === 'actionCoinPage' &&
                        R.test(window.location.href)
                    ) {
                        console.log('WINDOW LOCATION NOT CHANGE');
                        ToolX.href = window.location.href;
                        return null;
                    }

                    // alert change!
                    console.log('WINDOW LOCATION CHANGE');

                    _this.stop()
                    _this.route()

                    // window.location =   window.location+'';
                    ToolX.href = window.location.href;
                }

            } catch (e) {
                console.log(e)
                clearInterval(timer)
            }

        }, 250);
    }


    current_token = {}

    actionCoinPage() {

        let location = unsafeWindow.location.href + '';
        let coin = location.match(/\/token\/(.+?)_(.+?)(\?|$)/) //

        if (coin) {
            coin = coin[2]
        } else {
            coin = location.match(/\/token\/(.+?)(\?|$)/)
            coin = coin[1]
        }
        if (!coin) {
            alert('Coin not found!');

        }

        let creator_address = unsafeWindow.document.getElementsByTagName('body')[0].innerHTML.match(/"creator_address":"(.+?)"/)[1];

        this.current_token = {
            coin: coin,
            creator_address: creator_address,

        }
        console.log(this.current_token);

        this.CoinPageAddEvents();

    }


    initStyle() {
        this.styles = '.toolx_newcoin .g-table-cell { ' + STYLE_NEW_COIN + '  }'
        super.initStyle();
    }


    ChartDom(dom_row, coin_info) {
        let u = dom_row.querySelectorAll('div > a > div:nth-child(2) > div')[0]
        /*
       <div class="css-1c1kq07" style="
display: flex;
gap: 8px;
align-items: center;
"><img src="https://cryptochart.local/api.php?action=img&amp;coin=6sZyz9S8TUDrYwW3dLsuaxRZUp29YHqsoia2uCvNkmcH&amp;chtime=1731652900&amp;sizename=bullx" class="coin_image"></div>
*/

        let div = unsafeWindow.document.createElement('div');
        div.style.setProperty('display', 'flex');
        div.style.setProperty('gap', '8px');


        //  div.className = 'flex items-center justify-between border-b pb-2 border-grey-600';

        let img = unsafeWindow.document.createElement('img');
        img.src = coin_info.chart.image + '&sizename=bullx';
        img.className = 'coin_image';

        div.appendChild(img)
        u.appendChild(div)
    }


    // стандартная функция поиска новых монет на странице
    searchNewCoins() {

        //div.g-table-tbody-virtual-holder-inner
        let columns_o = unsafeWindow.document.querySelectorAll('div.g-table-wrapper')

        if (!columns_o.length) {
            return 1;
            //throw new Error('error search coin!');
        }


        // монеты в разных колонках могут быть одинаковые.
        this.count_new = 0;
        let _this = this
        for (let i = 0; i < 3; i = i + 1) {
            if (DASHBOARD_COLUM_WATCH.includes(i + 1))
                [...columns_o[i].querySelectorAll('.g-table-row')].map((row) => _this.eachCoinsInPage(i + 1, row));
        }

        if (this.count_new && ALERT_NEW_COIN) {
            ToolX.alertNewCoin();
        }
        this.removeOldCoins()

        console.log('toolX new ', this.count_new);
        // this.getTrades()
    }
    removeOldCoins() {
        let time = new Date().getTime()
        let interval_delete = 120000;
        for (let i in ToolX.coins) {
            if ((time - ToolX.coins[i].time) < interval_delete) {
                continue;
            }
            delete ToolX.coins[i]
        }
    }

    eachCoinsInPage(coll_id, row) {

        let row_html = row.innerHTML
        let pairAddress = row_html.match(/token\/(.+?)"/, 'U')
        if (pairAddress === undefined) {

            throw new Error('error search coin!');
        }
        pairAddress = pairAddress[1];
        // удалённый
        if (ToolX.coins_hidden[pairAddress] !== undefined) {
            row.style.setProperty('border', '1px red solid');
            return 1;
            //continue;
        }
        if (ToolX.coins[pairAddress] === undefined) {
            this.eachCoinIsNew(coll_id, row, 'solana', pairAddress, pairAddress)
        } else {
            //  проверяем, возможно коин пропадал и снова показался, либо он мог мигрировать, проверяем всё это
            this.eachCoinIsNotNew(coll_id, row, 'solana', pairAddress, pairAddress)
        }
        ToolX.coins[pairAddress].time = new Date().getTime()

    }

    // сайт очень хреново удаляет иконки, вернее не умеет это делать
    EventRowDelete(e, pairAddress, row) {
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            e.cancelBubble = true;

            ToolX.hideCoin(pairAddress)
            row.style.setProperty('border', '1px red solid');
            return false
        }
    }


    rowEventRemove(pairAddress, row) {
        if (ToolX.key === HOTKEYS.HIDECOIN) {
            ToolX.hideCoin(pairAddress)
            row.style.setProperty('border', '1px red solid');
        }
    }


}// END: Gmgn.js-------------------------------------------------------
// START: Virtuals.js-------------------------------------------------------

class Virtuals  extends CoinMixin(ToolXService) {
    constructor() {
        super();

        this.routers['app.virtuals.io/prototypes/.+'] = 'actionAppCoinPage';

    }

    current_token={}
    _tokenappData = null


    actionAppCoinPage() {
        let location =  unsafeWindow.location+'';
        let tokenId = location.match(/\/prototypes\/(.+)/)[1]
        let _this = this

       unsafeWindow.fetch( 'https://api.virtuals.io/api/virtuals?filters[preToken]='+tokenId+'&populate[0]=image&populate[1]=tier&pagination[page]=1&pagination[pageSize]=1')
            .then(response => response.json())
            .then(function (result) {
                _this._tokenappData = result.data[0]

                console.log(result);

                let token = _this._tokenappData.tokenAddress;
                let tokenPreToken = _this._tokenappData.preToken;
                let creator_address = _this._tokenappData.walletAddress;
                _this.current_token = {
                    coin:token,
                    tokenPreToken: tokenPreToken,
                    creator_address:creator_address,
                }
                console.log( _this.current_token);
                _this.CoinPageAddEvents()

            })

    }


    CoinPageAddEvents(){
        let _this = this


        this.addKeydownEventListener((e) => {
            let coin =  _this.current_token.tokenPreToken
            let creator_address = _this.current_token.creator_address
            switch (e.key) {

                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET:
                case HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET_CURRENTPAGE:
                    GM.openInTab('https://x.com/search?q=' + coin, e.key === HOTKEYS.COINPAGE_OPEN_SEARCH_TWITTER_TOKET );
                    break;

                case HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK:
                case HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK_CURRENTPAGE:
                    GM.openInTab('https://debank.com/profile/' + creator_address, e.key === HOTKEYS.COINPAGE_OPEN_CREATOR_DEBANK );
                    break;




            }
        })
    }
 



}// END: Virtuals.js-------------------------------------------------------


(function () {
    'use strict';

    // скрипт не будет работать в ифреймах
    if( unsafeWindow.self !== unsafeWindow.top ){
        return 1;
    }

    window.addEventListener('load', function (event) {
                console.log("TOOLX START");

                ToolX.init();
                ToolX.run();

                console.log("TOOLX END");
    });


})();
