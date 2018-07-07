
Sky.declare=function(conf){
	if(!('extends' in conf)){
		conf['extends']=Object;
	}
	if(!('property' in conf)){
		conf.property=new Object();
	}
	if(!('member' in conf)){
		conf.member=new Object();
	}
	if(!('method' in conf)){
		conf.method=new Object();
	}
	var value,member,SuperClass;
	var hasProperty=false;
	var constructor=function(){
		var me=this,self;
		if(this.constructor!=arguments.callee){//函数运行
			if(conf.constructor){
				return conf.constructor.apply(this,arguments);
			}else if('extends' in conf){
				return conf['extends'].apply(this,arguments);
			}
		}else{//通过new运行
			//在IE8中 Sky.support.defineProperty为false
			if(hasProperty && !Sky.support.defineProperty && Sky.support.VBScript){
				me=VBClassFactory(conf);
				me.constructor=constructor;
				for(member in constructor.prototype){
					if(member in me){
						var fun=constructor.prototype[member];
						if(Sky.isFunction(fun)){
							me[member]=bindFun(fun,me);
						}
					}
				}
			}
			if(!conf.constructor && ('extends' in conf)){
				SuperClass=conf['extends'];
				if(Object.setPrototypeOf && arguments.length===0){//Map Set 之类的类不能执行构造函数
					me=new SuperClass();
					Object.setPrototypeOf(me,SuperClass.prototype);
					for(member in conf.member){
						if(member in me){
							me[member]=conf.member[member];
						}
					}
				}
			}
			for(member in conf.member){
				if(member in me){
					me[member]=conf.member[member];
				}
			}
			if(hasProperty){
				if(Sky.support.defineProperty){
					for(member in conf.property){
						value=conf.property[member];
						if(value && (Sky.isFunction(value.get) || Sky.isFunction(value.set))){
							value.enumerable=true;
							Object.defineProperty(me, member ,value);
						}
					}
				}
			}
			if(conf.constructor){
				self=conf.constructor.apply(me,arguments);
				if(self){
					me=self;
				}
			}else if('extends' in conf){
				SuperClass=conf['extends'];
				if(Object.setPrototypeOf && arguments.length===0){
				}else{
					self=SuperClass.apply(me,arguments);
					if(self){
						me=self;
					}
				}
			}
			if(hasProperty){
				//阻止自己添加属性，必须在配置里member加属性
				if(Object.preventExtensions) Object.preventExtensions(me);
			}
		}
		return me;
	};
	function bindFun(fun,me){
		var methodCall=function methodCall(){
			return fun.apply(me,arguments);
		};
		methodCall.apply=function(obj,args){
			return fun.apply(obj,args);
		};
		methodCall.call=function(obj){
			var args=Array.from(arguments);
			args.shift();
			return fun.apply(obj,args);
		};
		return methodCall;
	}
	if('extends' in conf){
		SuperClass=conf['extends'];
		constructor.prototype=Object.create(SuperClass.prototype);
		constructor.prototype.constructor=constructor;
		constructor.superclass=SuperClass;
		var superConf=Sky.declare.config.get(conf['extends']);
		if(superConf){
			if(!Sky.hasOwn(conf,'constructor')){
				conf.constructor=superConf.constructor;
			}
			Sky.applyIf(conf.property,superConf.property);
			Sky.applyIf(conf.member,superConf.member);
			Sky.applyIf(conf.method,superConf.method);
		}
	}
	for(member in conf.property){
		value=conf.property[member];
		if(value && (Sky.isFunction(value.get) || Sky.isFunction(value.set))){
			hasProperty=true;
		}
	}
	Object.assign(constructor.prototype,conf.method);
	conf.prototype=constructor.prototype;
	if(conf.static){
		Object.assign(constructor,conf.static);
	}
	if(hasProperty){
		Sky.declare.config.set(constructor,conf);
	}
	return constructor;
};
if(Sky.support.VBScript){
	window.VBClassPool=new Map();
	window.VBClassSetter=function(instance, propertys, name, value){
		var property = propertys[name];
		property.set.call(instance, value);
	};
	window.VBClassGetter=function(instance, propertys, name){
		var property = propertys[name];
		return property.get.call(instance);
	};
	//从avalon学到的方式，通过VB
	window.VBClassFactory=function(conf){
		var className=VBClassPool.get(conf);
		if(!className){
			className="VBClass_"+Sky.nextSequence();
			VBClassPool.set(conf,className);
			var buffer = ["Class "+className];
			var key;
			var uniq={
				'__propertys__':true,
				'constructor':true
			};
			buffer.push('Public [__propertys__]');
			buffer.push('Public [constructor]');
			for(key in conf.prototype){
				if(!uniq[key]){
					buffer.push('Public ['+key+']');
					uniq[key]=true;
				}
			}
			for(key in conf.member){
				if(!uniq[key]){
					buffer.push('Public ['+key+']');
					uniq[key]=true;
				}
			}
			for(key in conf.property){
				if(!uniq[key]){
					var property=conf.property[key];
					buffer.push(
						//由于不知对方会传入什么,因此set, let都用上
						'Public Property Let ['+key+'](value)', //setter
						'	Call VBClassSetter(Me, [__propertys__], "'+key+'",value)',
						'End Property',
						'Public Property Set ['+key+'](value)', //setter
						'	Call VBClassSetter(Me, [__propertys__], "' + key + '",value)',
						'End Property',
						'Public Property Get ['+key+']', //getter
						'	On Error Resume Next', //必须优先使用set语句,否则它会误将数组当字符串返回
						'	Set['+key+'] = VBClassGetter(Me, [__propertys__],"'+key+'")',
						'	If Err.Number <> 0 Then',
						'		['+key+'] = VBClassGetter(Me, [__propertys__],"'+key+'")',
						'	End If',
						'	On Error Goto 0',
						'End Property');
					uniq[key]=true;
				}
			}
			buffer.push('End Class');
			buffer.push(
				'Function ' + className + '_Factory(property)', //创建实例并传入两个关键的参数
				'	Dim o',
				'	Set o = New '+className,
				'	Set o.[__propertys__] = property',
				'	Set '+className+'_Factory=o',
				'End Function'
			);
			window.execScript(buffer.join('\n'), 'VBScript');
		}
		return window[className + '_Factory'](conf.property); //得到其产品
	};
}
Sky.declare.config=new Map();
Sky.is=function(obj,Clazz){
	obj=Object(obj);
	if(obj instanceof Clazz){
		return true;
	}
	if(obj instanceof Object){
		return false;
	}
	var constructor=obj.constructor;
	if(constructor==Clazz){
		return true;
	}
	do{
		var superConf=Sky.declare.config.get(constructor);
		if(superConf){
			constructor=superConf['extends'];
			if(constructor==Clazz){
				return true;
			}
		}else{
			var proto=constructor.prototype;
			var oldProto=proto;
			do{
				if(proto==Clazz.prototype){
					return true;
				}
				proto=Object.getPrototypeOf(proto);
				if(proto==oldProto){
					break ;
				}
				oldProto=proto;
			}while(proto && proto!=Object.prototype);
			break ;
		}
	}while(constructor && constructor!=Object);
	return false;
};