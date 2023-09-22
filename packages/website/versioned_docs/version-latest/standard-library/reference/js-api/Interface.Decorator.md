---
jsApi: true
title: "[I] Decorator"

---
## Extends

- [`BaseType`](Interface.BaseType.md)

## Properties

| Property | Type | Description |
| :------ | :------ | :------ |
| `implementation` | (...`args`) => `void` | - |
| `instantiationParameters`? | [`Type`](Type.Type.md)[] | - |
| `isFinished` | `boolean` | Reflect if a type has been finished(Decorators have been called).<br />There is multiple reasons a type might not be finished:<br />- a template declaration will not<br />- a template instance that argument that are still template parameters<br />- a template instance that is only partially instantiated(like a templated operation inside a templated interface) |
| `kind` | `"Decorator"` | - |
| `name` | \`@$\{string}\` | - |
| `namespace` | [`Namespace`](Interface.Namespace.md) | - |
| `node` | [`DecoratorDeclarationStatementNode`](Interface.DecoratorDeclarationStatementNode.md) | - |
| `parameters` | [`FunctionParameter`](Interface.FunctionParameter.md)[] | - |
| `projectionBase`? | [`Type`](Type.Type.md) | - |
| `projectionSource`? | [`Type`](Type.Type.md) | - |
| `projector`? | [`Projector`](Interface.Projector.md) | - |
| `target` | [`FunctionParameter`](Interface.FunctionParameter.md) | - |

## Accessors

### projections

```ts
get projections(): ProjectionStatementNode[]
```

#### Inherited from

[`BaseType`](Interface.BaseType.md).[`projections`](Interface.BaseType.md#projections)

## Methods

### projectionsByName

```ts
projectionsByName(name): ProjectionStatementNode[]
```

#### Parameters

| Parameter | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`ProjectionStatementNode`](Interface.ProjectionStatementNode.md)[]

#### Inherited from

[`BaseType`](Interface.BaseType.md).[`projectionsByName`](Interface.BaseType.md#projectionsbyname)