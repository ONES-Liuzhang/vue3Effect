## 乞丐版Vue3双向绑定实现

Vue3中的双向绑定和Vue2中的基本原理是一样的，只是实现方式略有不同，Vue3删除了Watcher对象，使用Effect来代替，下面实现一个乞丐版的双向绑定。

### 响应式

#### ref

实现响应式的基本就是数据劫持，也可以说是让数据响应式，用ref举例子（因为ref特别简单，容易理解）

这里 ref 的实现是 Vue3.0.0 alpha 版本的实现，和当前版本有出入但是大体逻辑就是这么简单。

```js
// ref.js
import { track, trigger } from "./effect.js";

export function ref(val) {
  const r = {
    _isRef: true,
    _value: val,
    // getter 时触发 track 收集依赖
    get value() {
      track(r, "value");
      return this._value;
    },
    // setter 时触发 trigger 收集依赖
    set value(v) {
      this._value = v;
      trigger(r, "value");
    },
  };

  return r;
}
```



#### 写个Demo先

就来实现一个简单的功能吧

```js
import { ref } from "./reactivity/ref.js";
import { watch } from "./reactivity/effect.js";

/** 1. 使 a 响应式 */
const a = ref(0);

/** 2. 触发getter 收集依赖，记录下 cb */
watch(a, (val, oldVal) => {
  console.log(`a发生了变化： ${oldVal} -> ${val}`);
});

/** 没有cb的情况，也就是 watchEffect */
// watch(() => {
//  if (a.value === 1) {
//    console.log("1111");
//  }
// });

a.value++;

```



想要的打印结果：

```
a发生了变化： 0 -> 1
```



### 概念

Vue中的双向绑定使用了变种的观察者模式，观察者模式最基本的步骤是`依赖收集`和`触发依赖`两部分，Vue3中对应`track`函数和`trigger`函数

#### 全局变量

1. **targetsMap**: 全局储存所有对象的依赖
2. **effectStack**: 当`Effect`出现嵌套时，能保证依赖链正确
3. **activeEffect** : 当前活跃的`Effect`

```js
const targetsMap = new WeakMap()
const effectStack = []
let activeEffect 
```



#### track 函数

收集依赖，储存在全局`targetsMap`中

```js
/** 依赖收集 */
export function track(target, key) {
  // activeEffect 是一个全局变量(Vue2中的 Dep.target)
  if (!activeEffect) {
    return;
  }

  let depsMap = targetsMap.get(target);
  if (!depsMap) {
    targetsMap.set(target, (depsMap = new Map()));
  }

  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  if (!deps.has(activeEffect)) {
    deps.add(activeEffect);
    activeEffect.deps.push(deps);
  }
}
```

#### trigger 函数

```js
/** 依赖触发 */
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  let deps;
  if (key !== void 0) {
    deps = depsMap.get(key);
  }

  // 相当于 dep.notifyAll，通知所有 effect 进行重新求值
  if (deps) {
    deps.forEach((effect) => {
     effect()
    });
  }
}
```

#### Effect

```js
/** 创建一个副作用 即 watcher ，fn 即为 getter 函数 */
export function effect(fn, options) {
  const e = function () {
    try {
      effectStack.push(e);
      activeEffect = e;
      // effect 函数的本质就是触发 getter，getter中如果调用了其他响应式数据，也会递归触发它们的 getter
      // 这里和 vue2 里 Watcher 初始化时触发 getter 的逻辑是一样的
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };

  e.active = true;
  e._isEffect = true;
  e.deps = [];
  e.options = options;

  return e;
}
```

#### Watch

Vue3 中 watch 函数使用闭包来保存当前监听对象的值，整体逻辑简单来说和Vue2的逻辑差别不大：

1. 处理参数，获得 getter 函数
2. 创建 Effect (Watcher)
3. 执行 getter，进行初始化依赖收集

```js
export function watch(source, cb, { immediate } = {}) {
  const typeofSource = typeof source;
  let getter;
  // 处理参数，由于是乞丐版，所以只处理一下 ref
  if (typeofSource === "function") {
    getter = source;
  } else if (source._isRef) {
    getter = () => source.value;
  } else {
    getter = () => source;
  }

  let oldVal;
  const job = () => {
    if (cb) {
      const newVal = runner();
      if (oldVal !== newVal) {
        cb(newVal, oldVal);
        oldVal = newVal;
      }
    } else {
      runner();
    }
  };
	
  // 创建了一个 Effect (熟悉Vue2的同学可以直接理解为创建了一个 Watcher)
  // job 是 Vue3 做任务调度的一个中间任务，这里没有加入任务调度，而是直接触发
  // job 函数是一个闭包函数，内部包含 cb 的信息，把 job 传递给 effect，这样在 trigger 时才可以触发
  const runner = effect(getter, {
    job
  });

  // 初始化求值，触发 getter，收集依赖
  // 有 cb 函数和没有 cb 函数的逻辑有一点不同，没有 cb 函数的 watch 可以把它叫做 watchEffect
  if (cb) {
    if (immediate) {
      job();
    } else {
      oldVal = runner();
    }
  } else {
    runner();
  }
}

```

