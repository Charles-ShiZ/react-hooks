/* eslint-disable @typescript-eslint/naming-convention */
import { useEffect, useMemo, useRef } from 'react'
import {
  useUpdateEffect,
  useDebounceFn,
  useSessionStorageState,
  useLocalStorageState,
} from 'ahooks'

type TObject = Record<string, unknown>

type StoreType<S> = {
  data: S
  required?: S extends TObject ? Array<keyof S> : undefined
  when?: unknown
  title?: string
}

type RestoreType<S> = {
  callback: (data: S) => void
  when?: unknown
  mount?: boolean
  prompt?: string
  delay?: number
}

const typeOf = (object: unknown) => {
  return Object.prototype.toString.call(object).slice(8, -1).toLowerCase()
}

const isValid = (newData: unknown): boolean => {
  if (typeOf(newData) === 'object') {
    const object = newData as TObject
    return Object.keys(object).every((key) => isValid(object[key]))
  }
  if (typeOf(newData) === 'array') {
    const array = newData as Array<unknown>
    return !!array.length && array.every((i) => !!i) // every 接受空数组返回 true
  }
  if (typeOf(newData) === 'map') {
    const map = newData as Map<unknown, unknown>
    return !!map.size
  }
  if (typeOf(newData) === 'set') {
    const set = newData as Set<unknown>
    return !!set.size
  }
  return !!newData
}
const objectHasKey = (obj: TObject, key: string) => {
  // 真正地区分有无传参数
  return Object.keys(obj).includes(key)
}

const defaultPromot = '你有缓存数据，是否填充？'

const storageHooks = new Map([
  ['session', useSessionStorageState],
  ['local', useLocalStorageState],
])

const keySet = new Set<string>()

function useRestoreState<S>(props: {
  key: string
  debugTag?: string
  when?: unknown
  mode?: 'session' | 'local'
  open: boolean
  store: StoreType<S>
  restore: RestoreType<S>
  test?: boolean
  // 测试模式，当 test 为 true 时，restore 数据时，将不会弹出选择框，而是直接执行回调，方便进行单元测试
}) {
  const {
    key,
    debugTag,
    mode = 'session',
    open = false,
    store: { title = '', data: newData, required },
    restore: { callback, prompt = defaultPromot, delay = 500 },
    test,
  } = props
  const storageHook = storageHooks.get(mode)
  if (!open || !storageHook) return

  if (debugTag) {
    console.log(debugTag, key)
  }

  const storageHookKey = useRef(key)
  // 每个 hook 只会执行一次
  useMemo(() => {
    if (keySet.has(storageHookKey.current)) {
      //   console.error('useRestoreState 存在重复的 key 值，请保持 key 值唯一')
      console.error('There are duplicate key ​of useRestoreState, please keep the key ​unique')
    } else {
      keySet.add(storageHookKey.current)
    }
  }, [key])

  try {
    const [storedData, store] = storageHook<Partial<S>>(storageHookKey.current)

    /**************************** 根据 required, 提取出必填的数据 *****************************************/
    const requiredData = useMemo(() => {
      if (newData && typeof newData === 'object' && Array.isArray(required)) {
        const requiredData: Partial<S> = {}
        required.forEach((k) => (requiredData[k] = newData[k]))
        return requiredData
      }
      return newData
    }, [JSON.stringify(newData), JSON.stringify(required)])
    /***************************************************************************************************/

    /************ canStore：当传入数据有效、缓存的数据和新数据有差别 和 满足额外条件时，canStore 为 true **********
     */
    const canStore = (() => {
      const isDataValid = isValid(requiredData)
      const isDifferent = JSON.stringify(storedData) !== JSON.stringify(requiredData)
      const extraStoreCond = (() => {
        if (objectHasKey(props.store, 'when')) {
          return !!props.store.when
        }
        if (objectHasKey(props, 'when')) {
          return !!props.when
        }
        return true
      })()
      return isDataValid && isDifferent && extraStoreCond
    })()
    /****************************************************************************************************/

    /************************* triggerRestore、canRestore ******************************/
    const triggerRestore = (() => {
      if (objectHasKey(props.restore, 'when')) {
        return !!props.restore.when
      }
      if (objectHasKey(props, 'when')) {
        return !!props.when
      }
      return true
    })()

    const canRestore = (() => {
      const hasStoredData = !!storedData
      const isDifferent = JSON.stringify(storedData) !== JSON.stringify(requiredData)
      return hasStoredData && isDifferent
    })()
    /****************************************************************************************************/

    /****************** canStore 条件成立时，缓存数据 ******************/
    const { run: storeStateDeb } = useDebounceFn(
      () => {
        if (canStore) {
          console.log(
            `%c<-- useRestoreState${title} 已${storedData ? '更新' : '缓存'}数据 -->`,
            'color: #43bb88;font-weight: bold;',
            key,
            requiredData
          )
          store(requiredData)
        }
      },
      { wait: 500 }
    )
    useUpdateEffect(storeStateDeb, [JSON.stringify(requiredData)])
    /****************************************************************/

    /********** triggerRestore、canRestore 条件成立时，释放数据 **********/
    const { run: restoreStateDeb } = useDebounceFn(
      () => {
        if (triggerRestore && canRestore) {
          if (test) {
            callback({ ...newData, ...storedData })
            return
          }
          if (confirm(prompt)) callback({ ...newData, ...storedData })
        }
      },
      { wait: delay }
    )
    useEffect(restoreStateDeb, [triggerRestore])
    /****************************************************************/

    // if (mount) {
    //   useEffect(restoreStateDeb, [triggerRestore])
    // } else {
    //   useUpdateEffect(restoreStateDeb, [triggerRestore])
    // }
  } catch (error) {
    console.log(`useRestoreState-${storageHookKey}`, error)
  }
}

export default useRestoreState
