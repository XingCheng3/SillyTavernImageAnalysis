import axios from 'axios'
import { ElMessage } from 'element-plus'
import { v4 as uuidv4 } from 'uuid';


// /// <summary>
// /// 执行SQL请求参数
// /// </summary>
// public class ReqParam
// {
//     /// <summary>
//     /// 请求时的唯一ID
//     /// </summary>
//     [Required]
//     [JsonPropertyName("uuid")]
//     public string UUID { get; set; }

//     /// <summary>
//     /// 来自调用端的描述
//     /// </summary>
//     [StringLength(50)]
//     [JsonPropertyName("from")]
//     public string From { get; set; }

//     /// <summary>
//     /// 操作用户
//     /// </summary>
//     [Required]
//     [StringLength(50)]
//     [JsonPropertyName("user")]
//     public string User { get; set; }

//     /// <summary>
//     /// 操作类型
//     /// 1.直接执行SQL语句
//     /// 2.直接执行存储过程
//     /// </summary>
//     [Required]
//     [RegularExpression("^[1-2]$")]
//     [JsonPropertyName("type")]
//     public string Type { get; set; }

//     /// <summary>
//     /// 存储过程名称 或者 SQL语句
//     /// </summary>
//     [Required]
//     [StringLength(500)]
//     [JsonPropertyName("storeName")]
//     public string StoreName { get; set; }

//     /// <summary>
//     /// 请求参数列表
//     /// [
//     ///     ["参数名", "参数值"],
//     ///     ["参数名", "参数值"]
//     /// ]
//     /// </summary>
//     [Required]
//     [JsonPropertyName("paramList")]
//     public List<List<string>> ParamList { get; set; }

//     /// <summary>
//     /// 将参数列表转换为字典格式
//     /// </summary>
//     public Dictionary<string, object> GetParameters()
//     {
//         var parameters = new Dictionary<string, object>();
//         foreach (var param in ParamList)
//         {
//             if (param.Count >= 2)
//             {
//                 parameters[param[0]] = param[1];
//             }
//         }
//         return parameters;
//     }
// }

// /// <summary>
// /// 统一API响应格式
// /// </summary>
// public class ApiResponse
// {
//     /// <summary>
//     /// 响应状态码
//     /// 1: 成功 2: 失败 3: 系统错误
//     /// </summary>
//     public int Code { get; }

//     /// <summary>
//     /// 结果消息 是直接返回存储过程执行的结果 或者 是查询语句执行的结果
//     /// </summary>
//     public string Message { get; }

//     /// <summary>
//     /// 返回数据内容
//     /// </summary>
//     public object Data { get; }

// 示例 如  

// ALTER PROCEDURE [dbo].[基础表_用户角色_用户登录]
// @userName nvarchar(50),
// @password nvarchar(50)
// AS
// select @userName as result,@password as msg

// storeName = '基础表_用户角色_用户登录' type = 2 data = [['userName', '111'], ['password', '222']]
// 返回结果 data = {result: '111', msg: '222'}

/**
 * 执行数据库操作
 * @param {number} type - 操作类型
 * @param {string} spName - 存储过程名称
 * @param {Array<[string, any]>} paramList - 参数列表
 * @returns {Promise<any>} - 执行结果
 */
export async function ExecDatabase(type, spName, paramList) {
  try {
    console.log('发送请求到:', window.g.API_SQL_URL);
    const uuid = uuidv4()
    const user = 'admin' // 默认用户

    // // 转换参数格式
    // const formattedParams = paramList.map(param => {
    //   if (typeof param === 'object' && param.name && param.value) {
    //     return [param.name, param.value]
    //   } else if (Array.isArray(param) && param.length >= 2) {
    //     return [String(param[0]), String(param[1])]
    //   }
    //   return param
    // })

    const response = await axios.post(window.g.API_SQL_URL, {
      uuid,
      from: 'vue3',
      user,
      type: type.toString(),
      storeName: spName,
      paramList: paramList
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // 接受所有状态码
      },
      timeout: 30000, // 设置超时时间
      withCredentials: false // 禁用凭证
    })

    console.log('收到响应:', response);

    if (response.data.code === 1) {
      return response.data.data
    } else {
      // throw new Error(response.data.message || '数据库操作失败')
      ElMessage.error(response.data.message || '数据库操作失败')
      return []
    }
  } catch (error) {
    console.error('数据库操作失败:', error)
    if (error.response) {
      // 服务器返回了错误状态码
      console.error('错误状态码:', error.response.status)
      console.error('错误响应:', error.response.data)
      ElMessage.error(`服务器错误: ${error.response.status}`)
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('没有收到响应:', error.request)
      console.error('请求URL:', error.config?.url)
      console.error('请求方法:', error.config?.method)
      console.error('请求头:', error.config?.headers)
      ElMessage.error('无法连接到服务器，请检查网络连接')
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message)
      ElMessage.error('请求配置错误')
    }
    return []
    // throw error
  }
}

// Vue插件
export default {
    install(app) {
        app.config.globalProperties.ExecDatabase = ExecDatabase
    }
}
