/** 全局变量 */
const targetsMap = new WeakMap();
const effectStack = [];
let activeEffect;

/** 创建一个副作用 即 watcher */
export function effect(fn, options) {
  const e = function () {
    try {
      effectStack.push(e);
      activeEffect = e;
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };

  e.active = true;
  e._isEffect = true;
  e.deps = [];
  e.raw = fn;
  e.options = options;

  return e;
}

export function watch(source, cb, { lazy, deep, immediate } = {}) {
  const typeofSource = typeof source;
  let getter;
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

  const runner = effect(getter, {
    lazy,
    job,
  });

  // 初始化求值，触发 getter，收集依赖
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

/** 依赖收集 */
export function track(target, key) {
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
      if (effect.options.job) {
        effect.options.job();
      } else {
        effect();
      }
    });
  }
}
