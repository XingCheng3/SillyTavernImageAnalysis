import {defineStore} from 'pinia'


// 第一个参数是应用程序中 store 的唯一 id
export const useUserStore = defineStore('UserData', {
    // 其它配置项
    state: () => {
        return {
            user: null,
        };
    },
    actions: {
        setUser(userInfo) {
            this.user = {
                ...this.user,
                ...userInfo
            };
        }
    }
})