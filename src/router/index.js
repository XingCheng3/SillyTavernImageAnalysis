import {createRouter, createWebHashHistory} from "vue-router";
import {useAppStore} from "@/stores/app";
import {useUserStore} from "@/stores/user";
import Cookies from 'js-cookie';

// cookies

// 创建一个通用的组件加载函数
const loadView = (viewPath) => {
    return () => {
        // 使用具体的动态导入语法
        const component = import.meta.glob('@/views/**/*.vue');
        const path = `/src/views/${viewPath}`;
        
        if (!component[path]) {
            console.error(`找不到组件: ${path}`);
            return Promise.resolve({
                template: `<div class="error-page">组件加载失败，请刷新页面或联系管理员</div>`
            });
        }
        
        return component[path]().catch(error => {
            console.error(`加载组件失败: ${viewPath}`, error);
            return {
                template: `<div class="error-page">组件加载失败，请刷新页面或联系管理员</div>`
            };
        });
    };
};

// 创建routes
const routes = [
    // {
    //     path: "/",
    //     name: "Layout",
    //     component: loadView('Layout/index.vue'),
    //     redirect: '/GeminiApi',
    //     children: [
    //         {
    //             path: "/GeminiApi",
    //             name: "GeminiApi",
    //             component: loadView('GeminiApi/index.vue'),
    //             meta: {
    //                 title: "Gemini API"
    //             }
    //         },
    //         {
    //             path: "/TokenConfig",
    //             name: "TokenConfig",
    //             component: loadView('TokenConfig/index.vue'),
    //             meta: {
    //                 title: "TokenConfig"
    //             }
    //         },
    //         {
    //             path: "/AIEmailFriend",
    //             name: "AIEmailFriend",
    //             component: loadView('AIEmailFriend/index.vue'),
    //             meta: {
    //                 title: "AIEmailFriend"
    //             }
    //         }
    //     ]
    // },
    {
        path: "/",
        name: "index",
        component: loadView('index.vue'),
    },
    {
        path: "/stream",
        name: "stream",
        component: loadView('stream.vue'),
    },
    {
        path: "/:pathMatch(.*)*",
        redirect: "/",
    },
];

//History路由模型
const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes,
});

//这里设置路由拦截
router.beforeEach(async (to, from, next) => {
    // const userStore = useUserStore();
    
    // // 如果是登录页面，直接放行
    // if (to.path === '/login') {
    //     next();
    //     return;
    // }
    
    // // 检查store中是否存在用户信息
    // if (!userStore.user || !userStore.user.ID) {
    //     // 检查cookie中是否存在用户信息
    //     const userInfo = Cookies.get('userInfo');
    //     if (userInfo) {
    //         try {
    //             // 将cookie中的用户信息加载到store
    //             const parsedUserInfo = JSON.parse(userInfo);
    //             userStore.setUser(parsedUserInfo);
    //             next();
    //         } catch (error) {
    //             console.error('解析用户信息失败:', error);
    //             next('/login');
    //         }
    //     } else {
    //         next('/login');
    //     }
    // } else {
    //     next();
    // }
    next();
});

export default router;
