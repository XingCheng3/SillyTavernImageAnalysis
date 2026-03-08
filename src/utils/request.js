import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const service = axios.create({
    baseURL: window.g?.API_SQL_URL, // 直接使用API地址
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// 请求拦截器
service.interceptors.request.use(
    config => {
        return config
    },
    error => {
        console.error('请求错误:', error)
        return Promise.reject(error)
    }
)

// 响应拦截器
service.interceptors.response.use(
    response => {
        const res = response.data
        return res
    },
    error => {
        console.error('响应错误:', error)
        ElMessage.error('请求失败，请检查网络连接')
        return Promise.reject(error)
    }
)

export default service