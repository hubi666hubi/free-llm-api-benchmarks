import {
  IDependencyContainer,
  Factory,
  RegistrationOptions,
} from "./interfaces";

interface FactoryRegistration<T> {
  factory: Factory<T>;
  singleton: boolean;
  cachedInstance?: T;
}

export class Container implements IDependencyContainer {
  private instances = new Map<string | symbol, any>();
  private factories = new Map<string | symbol, FactoryRegistration<any>>();
  private parent?: Container;

  constructor(parent?: Container) {
    this.parent = parent;
  }

  registerInstance<T>(token: string | symbol, instance: T): this {
    this.instances.set(token, instance);
    this.factories.delete(token);
    return this;
  }

  registerFactory<T>(
    token: string | symbol,
    factory: Factory<T>,
    options?: RegistrationOptions
  ): this {
    this.factories.set(token, {
      factory,
      singleton: options?.singleton ?? true,
    });
    this.instances.delete(token);
    return this;
  }

  resolve<T>(token: string | symbol): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const reg = this.factories.get(token);
    if (reg) {
      if (reg.singleton) {
        if (reg.cachedInstance === undefined) {
          reg.cachedInstance = reg.factory(this);
        }
        return reg.cachedInstance;
      }
      return reg.factory(this);
    }

    if (this.parent && this.parent.has(token)) {
      return this.parent.resolve<T>(token);
    }

    throw new Error(`DI Container: No registration found for token "${String(token)}"`);
  }

  has(token: string | symbol): boolean {
    if (this.instances.has(token) || this.factories.has(token)) {
      return true;
    }
    return this.parent ? this.parent.has(token) : false;
  }

  clear(): void {
    this.instances.clear();
    this.factories.clear();
  }

  createChild(): Container {
    return new Container(this);
  }
}
