import { inject } from 'vue';
import { useRouter } from 'vue-router';
import {ElMessage} from "element-plus";
import Cookies from "vue-cookies";


export function useRouteGuard() {
    const router = useRouter();
    const CreateData = inject('CreateData');
    const ExecDatabase = inject('ExecDatabase');
    let userId = Cookies.get('userId')
    // 防止首次或者刷新界面路由失效
    let registerRouteFresh = true
    router.beforeEach(async (to, from, next) => {
        if (registerRouteFresh) {
            if(userId !== ''){
                // 获取权限列表
                var param = []
                param[0] = ['userId', userId]
                var Data = CreateData('11', '基础表_权限模块_查询', param)
                ExecDatabase(Data).then(response => {
                    if(response.data.length > 0){
                        routerData.value.userRouterList = response.data
                        // 创建动态路由列表
                        const dynamicRoutes = dynamicRouter(response.data);

                        dynamicRoutes.forEach((route) => {
                            // 检查是否已存在该路由，避免重复添加
                            if (!router.hasRoute(route.name)) {
                                router.addRoute('root', route);
                            }
                        });
                    }else{
                        ElMessage.warning('该角色未分配角色模块，请先进行分配!')
                    }
                    next({ ...to, replace: true })
                    registerRouteFresh = false
                })
            }else{
                next({ ...to, replace: true })
                registerRouteFresh = false
            }
        } else {
            if (to.meta.title) {
                window.document.title = to.meta.title;
            }
            next()
        }
    })

    // 递归替换引入component
    function dynamicRouter(routerList) {
        const list = [];
        routerList.forEach((route) => {
            const routeItem = {
                path: '/' + route.path,
                name:route.path,
                meta: {
                    title: route.权限模块,
                },
                component: async () => {
                    try {
                        const component = await import(`@/views/${route.path}/index.vue`);
                        console.log(component)
                        return component.default || component;
                    } catch (error) {
                        console.error('引入路由组件失败，请确认地址是否配置正确:', error);
                        return null;
                    }
                },
            };
            list.push(routeItem);
        });
        return list;
    }
}