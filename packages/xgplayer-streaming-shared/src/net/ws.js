import { NetError } from './error'
import { createResponse, setUrlParams, calculateSpeed } from './helper'
import { ResponseType } from './types'
import { EVENT } from '../event'
import EventEmitter from 'eventemitter3'

const CACHESIZE = 2 * 1024 * 1024

export class WsLoader extends EventEmitter {
  _socket = null
  _timeoutTimer = null
  _response = null
  _aborted = false
  _index = -1
  _range = null
  _receivedLength = 0
  _running = false
  _logger = null
  _vid = ''
  _onProcessMinLen = 0
  _onCancel = null
  _priOptions = null // 比较私有化的参数传递，回调时候透传
  _startTime = null
  _endTime = null

  constructor () {
    super()
  }

  load ({
    url,
    vid,
    timeout, // ms
    responseType,
    onProgress,
    index,
    onTimeout,
    onCancel,
    range,
    transformResponse,
    request,
    params,
    logger,
    method,
    headers,
    body,
    mode,
    credentials,
    cache,
    redirect,
    referrer,
    referrerPolicy,
    onProcessMinLen,
    priOptions
  }) {
    this._logger = logger
    this._aborted = false
    this._onProcessMinLen = onProcessMinLen
    this._onCancel = onCancel
    this._running = true
    this._index = index
    this._range = range || [0, 0]
    this._vid = vid || url
    this._priOptions = priOptions || {}

    let isTimeout = false
    clearTimeout(this._timeoutTimer)
    url = setUrlParams(url, params)

    if (timeout) {
      this._timeoutTimer = setTimeout(() => {
        isTimeout = true
        this.cancel()
        if (onTimeout) {
          const error = new NetError(url, null, 'timeout')
          error.isTimeout = true
          onTimeout(error, { index: this._index, range: this._range, vid: this._vid, priOptions: this._priOptions })
        }
      }, timeout)
    }

    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      this._socket = new WebSocket(url)
      this._socket.binaryType = responseType
      this._logger.debug('[websocket load start], index,', index, ',ws,', this._socket)
      this._socket.onopen = () => {
        clearTimeout(this._timeoutTimer)
        if (this._aborted || !this._running) return
        this._logger.debug('[websocket connected],ws',this._socket)

        this._startTime = Date.now()
        const firstByteTime = Date.now()

        this._socket.onmessage = (event) => {
          this._startTime = this._endTime || this._startTime
          this._endTime = Date.now()
          if (this._aborted || !this._running) return
          let data
          if (responseType === ResponseType.TEXT) {
            data = event.data
            this._running = false
          } else if (responseType === ResponseType.JSON) {
            data = JSON.parse(event.data)
            this._running = false
          } else {
            if (onProgress) {
              this.resolve = resolve
              this.reject = reject
              this._loadChunk(new Uint8Array(event.data), onProgress,startTime,firstByteTime)
              return
            } else {
              data = new Uint8Array(event.data)
              this._running = false
              const costTime = Date.now() - startTime
              const speed = calculateSpeed(data.byteLength, costTime)
              this.emit(EVENT.REAL_TIME_SPEED, { speed, len: data.byteLength, time: costTime, vid: this._vid, index: this._index, range: this._range, priOptions: this._priOptions })
            }
          }

          this._logger.debug('[websocket load end], index,', index, ',range,', range)

          resolve(createResponse(
            data,
            true,
            null,
            null,
            null,
            startTime,
            firstByteTime,
            index,
            range,
            this._vid,
            this._priOptions
          ))
        }
      }
      this._socket.onclose = (e)=>{
        this._endTime = null
        this._startTime = null
      }
      this._socket.onerror = (error) => {
        this._endTime = Date.now()
        clearTimeout(this._timeoutTimer)
        this._running = false
        if (this._aborted && !isTimeout) return
        error = new NetError(url, null, error?.message)
        error.startTime = startTime
        error.endTime = Date.now()
        error.isTimeout = isTimeout
        error.options = { index: this._index, range: this._range, vid: this._vid, priOptions: this._priOptions }
        reject(error)
      }
    })
  }

  async cancel () {
    if (this._aborted) return
    this._aborted = true
    this._running = false

    if (this._socket) {
      try {
        this._socket.close()
      } catch (error) {
        // ignore
      }
      this._socket = null
    }

    if (this._onCancel) {
      this._onCancel({ index: this._index, range: this._range, vid: this._vid, priOptions: this._priOptions })
    }
  }

  _loadChunk (data, onProgress,st, firstByteTime,intervalTime) {
    if (this._onProcessMinLen > 0) {
      this._cache = new Uint8Array(CACHESIZE)
      this._writeIdx = 0
    }
    const startRange = this._range?.length > 0 ? this._range[0] : 0
    const startByte = startRange + this._receivedLength
    if (this._aborted) {
      this._running = false
      onProgress(undefined, false, { range: [startByte, startByte], vid: this._vid, index: this._index, startTime:this._startTime, endTime: this._endTime, st, firstByteTime, priOptions: this._priOptions })
      return
    }

    const curLen = data.byteLength
    this._receivedLength += curLen

    const _done = [2,3].indexOf(this._socket.readyState) > 0
    this._logger.debug('【WsLoader,onProgress call】,task,', this._range, ', start,', startByte, ', end,', startRange + this._receivedLength, ', done,', _done)

    let retData


    if (this._onProcessMinLen > 0) {
      if (this._writeIdx + curLen >= this._onProcessMinLen || _done) {
        retData = new Uint8Array(this._writeIdx + curLen)
        retData.set(this._cache.slice(0, this._writeIdx), 0)
        curLen > 0 && retData.set(data, this._writeIdx)
        this._writeIdx = 0
        this._logger.debug('【WsLoader,onProgress enough】,done,', _done, ',len,', retData.byteLength, ', writeIdx,', this._writeIdx)
      } else {
        if (curLen > 0 && this._writeIdx + curLen < CACHESIZE) {
          this._cache.set(data, this._writeIdx)
          this._writeIdx += curLen
          this._logger.debug('【WsLoader,onProgress cache】,len,', curLen, ', writeIdx,', this._writeIdx)
        } else if (curLen > 0) {
          const temp = new Uint8Array(this._writeIdx + curLen + 2048)
          this._logger.debug('【WsLoader,onProgress extra start】,size,', this._writeIdx + curLen + 2048, ', datalen,', curLen, ', writeIdx,', this._writeIdx)
          temp.set(this._cache.slice(0, this._writeIdx), 0)
          curLen > 0 && temp.set(data, this._writeIdx)
          this._writeIdx += curLen
          delete this._cache
          this._cache = temp
          this._logger.debug('【WsLoader,onProgress extra end】,len,', curLen, ', writeIdx,', this._writeIdx)
        }
      }
    } else {
      retData = data
    }

    if (retData && retData.byteLength > 0 || _done) {
      onProgress(retData, _done, {
        range: [this._range[0] + this._receivedLength - (retData ? retData.byteLength : 0), this._range[0] + this._receivedLength],
        vid: this._vid,
        index: this._index,
        startTime:this._startTime,
        endTime:this._endTime,
        st,
        firstByteTime,
        priOptions: this._priOptions
      }, null)
    }

    if (_done){
      const costTime = Date.now() - st
      const speed = calculateSpeed(this._receivedLength, costTime)
      this.emit(EVENT.REAL_TIME_SPEED, { speed, len: this._receivedLength, time: costTime, vid: this._vid, index: this._index, range: this._range, priOptions: this._priOptions })

      this._running = false
      this._logger.debug('[WsLoader onProgress end],task,', this._range, ',done,', true)

      this.resolve(createResponse(
        retData,
        true,
        null,
        null,
        null,
        st,
        firstByteTime,
        this._index,
        this._range,
        this._vid,
        this._priOptions
      ))
    }
  }

  get receiveLen () {
    return this._receivedLength
  }

  get running () {
    return this._running
  }

  set running (status) {
    this._running = status
  }

  static isSupported () {
    return !!(typeof WebSocket !== 'undefined')
  }
}