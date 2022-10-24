import { useEffect, useMemo } from 'react'
import { useMount, useUpdateEffect, useDebounceFn } from 'ahooks'
import * as ahooks from 'ahooks'

type TObject = { [k: string]: unknown }

type TStore<S> = {
  data: S
  required?: S extends TObject ? Array<keyof S> : undefined
  when?: unknown
  title?: string
}

type TRestore<S> = {
  callback: (data: S) => void
  when?: unknown
  mount?: boolean
  prompt?: string
  delay?: number
}

function typeOf(object: unknown) {
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
let hookIndex = 0
// const mode = 'session' as 'session' | 'local'
const storageHooks = new Map([
  ['session', 'useSessionStorageState'],
  ['local', 'useLocalStorageState'],
])

function useRestoreState<S extends { [k: string]: unknown }>(config: {
  key?: string
  debugTag?: string
  mode?: 'session' | 'local'
  open: boolean
  when?: unknown
  store: TStore<S>
  restore: TRestore<S>
  test?: boolean 
	// 测试模式，当 test 为 true 时，restore 数据时，将不会弹出提示，而是直接执行回调，
	// 方便进行单元测试
}): void

function useRestoreState<S>(props: {
  key?: string
  debugTag?: string
  when?: unknown
  mode?: 'session' | 'local'
  open: boolean
  store: TStore<S>
  restore: TRestore<S>
  test?: boolean
}) {
  const {
    key,
    debugTag,
    mode = 'session',
    open = false,
    store: { title = '', data: newData, required },
    restore: { callback, prompt = defaultPromot, delay = 500 },
    test
  } = props
  if (!open) return
  try {
    const { pathname } = window.location
    const autokey = useMemo(() => {
      return pathname + '_' + ++hookIndex
    }, [pathname])
    if (debugTag) {
      console.log(debugTag, key)
    }
    const storageHookName = storageHooks.get(mode) as
      | 'useSessionStorageState'
      | 'useLocalStorageState'
    const [storedData, store] = ahooks[storageHookName]<Partial<S>>(key || `storedData_${autokey}`)

    const requiredData = useMemo(() => {
      if (newData && typeof newData === 'object' && Array.isArray(required)) {
        const requiredData: Partial<S> = {}
        required.forEach((k) => (requiredData[k] = newData[k]))
        return requiredData
      }
      return newData
    }, [JSON.stringify(newData), JSON.stringify(required)])

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

    // 当目标数据变化时，判断是否应当缓存，如是，则提示并缓存
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
  
    const { run: restoreStateDeb } = useDebounceFn(
      () => {
        if (triggerRestore && canRestore) {
          if(test) {
            callback({ ...newData, ...storedData })
            return
          }
          if (confirm(prompt)) callback({ ...newData, ...storedData })
        }
      },
      { wait: delay }
    )
    useEffect(restoreStateDeb, [triggerRestore])
    // if (mount) {
    //   useEffect(restoreStateDeb, [triggerRestore])
    // } else {
    //   useUpdateEffect(restoreStateDeb, [triggerRestore])
    // }
    useMount(() => {
      hookIndex = 0
    })
  } catch (error) {
    console.log('useRestoreState', error)
  }
}

export default useRestoreState