import { v4 as uuid } from 'uuid'
import mqtt from 'mqtt'
export { Mqtt }
class Mqtt {
  constructor(config) {
    this.connection = {
      host: config.host,
      port: config.port,
      endpoint: config.endpoint || '/mqtt',
      clean: config.clean || true,
      connectTimeout: config.connectTimeout || 4000,
      reconnectPeriod: config.reconnectPeriod || 4000,
      clientId: config.clientId || uuid(),
      username: config.username || '',
      password: config.password || ''
    }
    this.client = {
      connected: false
    }
  }
  // 创建连接
  createConnection() {
    // 连接字符串, 通过协议指定使用的连接方式
    // ws 未加密 WebSocket 连接
    // wss 加密 WebSocket 连接
    // mqtt 未加密 TCP 连接
    // mqtts 加密 TCP 连接
    // wxs 微信小程序连接
    // alis 支付宝小程序连接
    const { host, port, endpoint, ...options } = this.connection
    const connectUrl = `ws://${host}:${port}${endpoint}`
    try {
      this.client = mqtt.connect(connectUrl, options)
    } catch (error) {
      // 连接错位、
      this.connectError(error)
    }
  }
  connectError(error) {
    console.log('mqtt.connect error', error)
  }
  // 订阅主题
  doSubscribe(subscription) {
    const { topic, qos } = subscription
    let subscribeSuccess = false
    this.client.subscribe(topic, { qos }, (error, res) => {
      if (error) {
        subscribeSuccess = false
        console.log('Subscribe to topics error', error)
      } else {
        subscribeSuccess = true
        console.log('Subscribe to topics res', res)
      }
    })
    return subscribeSuccess
  }
  // 取消订阅
  doUnSubscribe(subscription) {
    const { topic } = subscription
    let unSubscribeSuccess = false
    this.client.unsubscribe(topic, error => {
      if (error) {
        unSubscribeSuccess = false
        console.log('Unsubscribe error', error)
      } else {
        unSubscribeSuccess = true
      }
    })
    return unSubscribeSuccess
  }
  // 发送消息
  doPublish(publish) {
    const { topic, qos, payload } = publish
    let doPublishSuccess = false
    this.client.publish(topic, payload, qos, error => {
      if (error) {
        doPublishSuccess = false
        console.log('Publish error', error)
      } else {
        doPublishSuccess = true
      }
    })
    return doPublishSuccess
  }
  // 断开连接
  destroyConnection() {
    let destroyConnectionSuccess = false
    if (this.client.connected) {
      try {
        this.client.end()
        this.client = {
          connected: false
        }
        destroyConnectionSuccess = true
        console.log('Successfully disconnected!')
      } catch (error) {
        destroyConnectionSuccess = false
        console.log('Disconnect failed', error.toString())
      }
    }
    return destroyConnectionSuccess
  }
}

