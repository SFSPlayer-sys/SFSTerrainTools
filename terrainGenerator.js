class TerrainGenerator {
    constructor(params) {
        this.maxHeight = params.maxHeight;
        this.minHeight = params.minHeight;
        this.nodeCount = params.nodeCount;
        this.data = new Array(this.nodeCount).fill(0);
        this.landmarks = [];
        this.landmarkDetails = {}; // 新增：存储地标详细信息的对象
        this.terrainMasks = new Array(this.nodeCount).fill(null).map(() => ({})); // 记录每个点属于哪种地貌
        
        // 默认地貌优先级
        this.priorities = {
            mountain: 5,
            volcano: 8,
            crater: 6,
            plateau: 4,
            plains: 3,
            ocean: 2
        };
    }

    // 在平均值附近生成随机值
    randomAround(average, variation = 0.3) {
        return average * (1 + (Math.random() - 0.5) * variation * 2);
    }
    
    // 获取配置参数的实际随机值
    getRandomizedValue(paramName, value, variation = 0.2) {
        // 存储原始平均值，便于日志记录
        if (!this.originalValues) this.originalValues = {};
        this.originalValues[paramName] = value;
        
        // 在平均值上随机变化
        return value * (1 + (Math.random() - 0.5) * variation * 2);
    }

    // 生成基础地形
    generateBaseProfile() {
        const baseSegments = Math.floor(this.nodeCount / 100);
        const baseHeight = (this.maxHeight + this.minHeight) / 2;
        const baseAmplitude = (this.maxHeight - this.minHeight) / 4; // 进一步增加基础振幅

        // 生成基础控制点
        const controlPoints = [];
        for (let i = 0; i <= baseSegments; i++) {
            controlPoints.push(baseHeight + (Math.random() - 0.5) * baseAmplitude * 2); // 进一步增加控制点变化
        }

        // 使用余弦插值生成平滑地形
        for (let i = 0; i < this.nodeCount; i++) {
            const segment = (i / this.nodeCount) * baseSegments;
            const index = Math.floor(segment);
            const t = segment - index;
            
            const p0 = controlPoints[index];
            const p1 = controlPoints[(index + 1) % controlPoints.length];
            
            // 余弦插值
            const f = (1 - Math.cos(t * Math.PI)) / 2;
            this.data[i] = p0 * (1 - f) + p1 * f;
            
            // 增强随机起伏
            this.data[i] += (Math.random() - 0.5) * baseAmplitude * 0.25;
        }

        // 确保首尾相连
        const smoothRange = Math.floor(this.nodeCount * 0.05);
        for (let i = 0; i < smoothRange; i++) {
            const weight = (Math.cos((i / smoothRange) * Math.PI) + 1) / 2;
            const start = this.data[i];
            const end = this.data[this.nodeCount - smoothRange + i];
            this.data[i] = end * (1 - weight) + start * weight;
            this.data[this.nodeCount - smoothRange + i] = start * (1 - weight) + end * weight;
        }
        
        // 减少平滑处理
        this.smoothTerrain(1);
        
        // 标记基础地形
        for (let i = 0; i < this.nodeCount; i++) {
            this.terrainMasks[i].base = 1.0;
        }
    }
    
    // 平滑处理函数
    smoothTerrain(passes = 1) {
        for (let pass = 0; pass < passes; pass++) {
            const smoothedData = [...this.data];
            for (let i = 0; i < this.nodeCount; i++) {
                const prev = (i - 1 + this.nodeCount) % this.nodeCount;
                const next = (i + 1) % this.nodeCount;
                smoothedData[i] = (this.data[prev] + this.data[i] + this.data[next]) / 3;
            }
            this.data = smoothedData;
        }
    }

    // 新增通用的描述生成方法
    generateDescription(type, params) {
        return '';
    }

    // 通用的类别描述获取方法
    getCategoryDescription(categories, value) {
        return categories.find(cat => 
            value >= cat.range[0] && value < cat.range[1]
        )?.desc || '普通';
    }

    // 添加山脉
    addMountains(count, width, height) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('mountainWidth', width);
        const randomHeight = this.getRandomizedValue('mountainHeight', height);
        
        // 确保生成count个山脉，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const mountainWidth = 360 * this.randomAround(randomWidth) * 0.8; // 减少山脉宽度，使其更陡峭
            const peak = this.maxHeight * this.randomAround(randomHeight) * 1.1; // 增加山脉高度
            const range = Math.floor(mountainWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360);
            
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                // 使用更陡峭的山脉曲线
                const mountainHeight = peak * Math.pow(1 - Math.pow(distance, 1.5), 1.2);
                
                // 直接添加山脉高度
                this.data[index] += mountainHeight;
            }
            
            const landmarkId = `mountain_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'mountain',
                angle: angle % 360,
                startAngle: (angle - mountainWidth/2 + 360) % 360,
                endAngle: (angle + mountainWidth/2) % 360,
                height: peak,
                width: mountainWidth,
                description: this.generateDescription('mountain', [peak, mountainWidth])
            };

            this.landmarks.push({
                name: `山脉${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 添加火山
    addVolcanoes(count, width, height, steepness = 0.7, craterWidth = 50, craterDepth = 0.45) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('volcanoWidth', width);
        const randomHeight = this.getRandomizedValue('volcanoHeight', height);
        const randomSteepness = this.getRandomizedValue('volcanoSteepness', steepness);
        const randomCraterDepth = this.getRandomizedValue('volcanoCraterDepth', craterDepth);
        
        // 确保生成count个火山，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const volcanoWidth = 360 * this.randomAround(randomWidth) * 0.6; // 显著减小火山宽度，使其更陡峭
            const peak = this.maxHeight * this.randomAround(randomHeight) * 1.4; // 大幅增加火山高度
            const range = Math.floor(volcanoWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360) % this.nodeCount;
            
            // 生成火山主体 - 使用更陡峭的曲线
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                // 使用更陡峭的火山形状 - 根据陡峭度参数调整指数曲线
                const volcanoHeight = peak * Math.exp(-Math.pow(distance * (2 + randomSteepness), 2));
                
                // 直接添加火山高度
                this.data[index] += volcanoHeight;
            }

            // 确保火山口宽度不大于火山宽度
            let craterWidthNodes = Math.floor(this.getRandomizedValue('volcanoCraterWidth', craterWidth));
            
            // 限制火山口宽度不超过火山宽度的75%
            const maxCraterNodes = Math.floor(range * 0.75);
            craterWidthNodes = Math.min(craterWidthNodes, maxCraterNodes);
            
            // 确保火山口宽度至少为20节点
            craterWidthNodes = Math.max(craterWidthNodes, 20);
            
            // 计算火山口深度值
            const craterDepthVal = peak * randomCraterDepth; // 火山口深度与火山高度的比例

            // 生成火山口 - 使用用户自定义的宽度和深度
            for (let j = -craterWidthNodes/2; j <= craterWidthNodes/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (craterWidthNodes/2);
                // 使用抛物线形状的火山口
                const craterProfile = craterDepthVal * (1 - Math.pow(distance, 2));
                this.data[index] -= craterProfile;
            }
            
            const landmarkId = `volcano_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'volcano',
                angle: angle % 360,
                startAngle: (angle - volcanoWidth/2 + 360) % 360,
                endAngle: (angle + volcanoWidth/2) % 360,
                height: peak,
                craterWidth: craterWidthNodes,
                description: this.generateDescription('volcano', [peak, craterWidthNodes])
            };

            this.landmarks.push({
                name: `火山${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 添加平原
    addPlains(count, width, roughness) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('plainsWidth', width);
        const randomRoughness = this.getRandomizedValue('plainsRoughness', roughness);
        
        // 确保生成count个平原，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const plainsWidth = 360 * this.randomAround(randomWidth);
            const range = Math.floor(plainsWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360);
            
            // 定义平原基础高度 - 略高于平均海平面
            const baseHeight = this.minHeight + (this.maxHeight - this.minHeight) * 0.4;
            
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                
                // 使用余弦曲线创建平滑的平原过渡
                const transitionFactor = (1 + Math.cos(Math.PI * distance)) / 2;
                
                // 根据粗糙度添加一些微小的随机变化
                const noise = (Math.random() - 0.5) * randomRoughness * (this.maxHeight - this.minHeight) * 0.05;
                
                // 直接设置平原高度
                this.data[index] = baseHeight + noise;
            }
            
            const landmarkId = `plains_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'plains',
                angle: angle % 360,
                startAngle: (angle - plainsWidth/2 + 360) % 360,
                endAngle: (angle + plainsWidth/2) % 360,
                roughness: randomRoughness,
                description: this.generateDescription('plains', [randomRoughness])
            };

            this.landmarks.push({
                name: `平原${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 添加撞击坑
    addCraters(count, width, depth) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('craterWidth', width);
        const randomDepth = this.getRandomizedValue('craterDepth', depth);
        
        // 确保生成count个撞击坑，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const craterWidth = 360 * this.randomAround(randomWidth);
            const craterDepth = this.maxHeight * this.randomAround(randomDepth) * 0.5; // 将深度控制在较小范围内
            const range = Math.floor(craterWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360);
            
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                
                // 使用更自然的撞击坑形状（带有边缘隆起）
                let craterHeight;
                if (distance < 0.8) {
                    // 撞击坑内部 - 使用二次曲线
                    craterHeight = -craterDepth * (1 - Math.pow(distance / 0.8, 2));
                } else {
                    // 撞击坑边缘 - 隆起部分
                    const rimFactor = (distance - 0.8) / 0.2; // 0到1的值，表示在边缘上的位置
                    craterHeight = craterDepth * 0.2 * Math.sin(rimFactor * Math.PI); // 使用正弦曲线创建平滑的边缘
                }
                
                // 直接添加撞击坑高度
                this.data[index] += craterHeight;
            }
            
            const landmarkId = `crater_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'crater',
                angle: angle % 360,
                startAngle: (angle - craterWidth/2 + 360) % 360,
                endAngle: (angle + craterWidth/2) % 360,
                depth: craterDepth,
                description: this.generateDescription('crater', [craterDepth])
            };

            this.landmarks.push({
                name: `撞击坑${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 添加海洋
    addOceans(count, width, depth) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('oceanWidth', width);
        const randomDepth = this.getRandomizedValue('oceanDepth', depth);
        
        // 确保生成count个海洋，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const oceanWidth = 360 * this.randomAround(randomWidth);
            const oceanDepth = this.maxHeight * this.randomAround(randomDepth);
            const range = Math.floor(oceanWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360);
            
            // 定义海底基础高度
            const baseHeight = this.minHeight + (this.maxHeight - this.minHeight) * 0.2;
            
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                
                // 使用平滑的余弦曲线创建海底地形
                const transitionFactor = Math.pow((1 + Math.cos(Math.PI * distance)) / 2, 1.5);
                
                // 添加一些随机变化以创建海底地形
                const noise = (Math.random() - 0.5) * 0.1 * oceanDepth;
                const oceanHeight = baseHeight - oceanDepth * transitionFactor + noise;
                
                // 直接设置海洋高度
                this.data[index] = oceanHeight;
            }
            
            const landmarkId = `ocean_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'ocean',
                angle: angle % 360,
                startAngle: (angle - oceanWidth/2 + 360) % 360,
                endAngle: (angle + oceanWidth/2) % 360,
                depth: oceanDepth,
                description: this.generateDescription('ocean', [oceanDepth])
            };

            this.landmarks.push({
                name: `海洋${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 添加高原
    addPlateaus(count, width, height) {
        // 使用随机化值
        const randomWidth = this.getRandomizedValue('plateauWidth', width);
        const randomHeight = this.getRandomizedValue('plateauHeight', height);
        
        // 确保生成count个高原，而不是按固定角度分布
        for (let i = 0; i < count; i++) {
            // 使用随机角度
            const angle = Math.random() * 360;
            const plateauWidth = 360 * this.randomAround(randomWidth);
            const range = Math.floor(plateauWidth * this.nodeCount / 360);
            const center = Math.floor(angle * this.nodeCount / 360);
            
            for (let j = -range/2; j <= range/2; j++) {
                const index = (center + j + this.nodeCount) % this.nodeCount;
                const distance = Math.abs(j) / (range/2);
                
                // 在高原中心区域保持较为平坦
                if (distance < 0.6) {
                    this.data[index] = randomHeight * (0.85 + Math.random() * 0.3);
                } else {
                    // 在边缘区域添加更大的随机变化
                    const edgePosition = (distance - 0.6) / 0.4;
                    const randomFactor = Math.random() * 0.4 - 0.2; // -0.2 到 0.2 的随机值
                    const heightFactor = Math.pow(Math.cos(edgePosition * Math.PI), 2) * (1 + randomFactor);
                    this.data[index] = randomHeight * heightFactor;
                }
            }
            
            const landmarkId = `plateau_${i + 1}`;
            
            this.landmarkDetails[landmarkId] = {
                type: 'plateau',
                angle: angle % 360,
                startAngle: (angle - plateauWidth/2 + 360) % 360,
                endAngle: (angle + plateauWidth/2) % 360,
                height: randomHeight,
                description: this.generateDescription('plateau', [randomHeight])
            };

            this.landmarks.push({
                name: `高原${i + 1}`,
                id: landmarkId
            });
        }
    }

    // 生成地形
    generate(options) {
        // 检查options是否为undefined或null
        if (!options) {
            console.error("错误：options参数为空");
            options = {}; // 使用空对象避免后续错误
        }
        
        // 重置数据
        this.data.fill(0);
        this.landmarks = [];
        this.terrainMasks = new Array(this.nodeCount).fill(null).map(() => ({}));
        
        // 检查每个地貌选项是否存在，如果不存在则初始化为空对象
        if (!options.mountain) options.mountain = { enabled: false, priority: this.priorities.mountain };
        if (!options.volcano) options.volcano = { enabled: false, priority: this.priorities.volcano };
        if (!options.crater) options.crater = { enabled: false, priority: this.priorities.crater };
        if (!options.plateau) options.plateau = { enabled: false, priority: this.priorities.plateau };
        if (!options.plains) options.plains = { enabled: false, priority: this.priorities.plains };
        if (!options.ocean) options.ocean = { enabled: false, priority: this.priorities.ocean };
        
        // 设置地貌优先级
        if (options.mountain && options.mountain.priority !== undefined) {
            this.priorities.mountain = options.mountain.priority;
        }
        if (options.volcano && options.volcano.priority !== undefined) {
            this.priorities.volcano = options.volcano.priority;
        }
        if (options.crater && options.crater.priority !== undefined) {
            this.priorities.crater = options.crater.priority;
        }
        if (options.plateau && options.plateau.priority !== undefined) {
            this.priorities.plateau = options.plateau.priority;
        }
        if (options.plains && options.plains.priority !== undefined) {
            this.priorities.plains = options.plains.priority;
        }
        if (options.ocean && options.ocean.priority !== undefined) {
            this.priorities.ocean = options.ocean.priority;
        }

        // 检查是否有任何地貌被选中
        const anyTerrainSelected = Object.values(options).some(opt => opt && opt.enabled);

        // 如果没有选择任何地貌，生成基础地形
        if (!anyTerrainSelected) {
            this.generateBaseProfile();
            return {
                points: this.data,
                landmarks: this.landmarks,
                landmarkDetails: this.landmarkDetails
            };
        }

        // 首先生成基础地形
        this.generateBaseProfile();
        
        // 根据优先级对地貌特征进行排序
        const terrainTypes = Object.keys(options).filter(key => options[key] && options[key].enabled);
        terrainTypes.sort((a, b) => this.priorities[b] - this.priorities[a]);
        
        // 先生成大型地貌特征
        const largeTerrains = ['ocean', 'plains', 'plateau'];
        for (const terrainType of terrainTypes) {
            if (largeTerrains.includes(terrainType)) {
                switch (terrainType) {
                    case 'ocean':
                        try {
                            this.addOceans(options.ocean.count, options.ocean.width, options.ocean.depth);
                        } catch (e) {
                            console.error("生成海洋时出错:", e);
                        }
                        break;
                    case 'plains':
                        try {
                            this.addPlains(options.plains.count, options.plains.width, options.plains.roughness);
                        } catch (e) {
                            console.error("生成平原时出错:", e);
                        }
                        break;
                    case 'plateau':
                        try {
                            this.addPlateaus(options.plateau.count, options.plateau.width, options.plateau.height);
                        } catch (e) {
                            console.error("生成高原时出错:", e);
                        }
                        break;
                }
            }
        }
        
        // 再生成中等大小地貌特征
        const mediumTerrains = ['crater', 'mountain'];
        for (const terrainType of terrainTypes) {
            if (mediumTerrains.includes(terrainType)) {
                switch (terrainType) {
                    case 'crater':
                        try {
                            this.addCraters(options.crater.count, options.crater.width, options.crater.depth);
                        } catch (e) {
                            console.error("生成撞击坑时出错:", e);
                        }
                        break;
                    case 'mountain':
                        try {
                            this.addMountains(options.mountain.count, options.mountain.width, options.mountain.height);
                        } catch (e) {
                            console.error("生成山脉时出错:", e);
                        }
                        break;
                }
            }
        }
        
        // 最后生成小型但特征显著的地貌
        const smallTerrains = ['volcano'];
        for (const terrainType of terrainTypes) {
            if (smallTerrains.includes(terrainType)) {
                if (terrainType === 'volcano') {
                    try {
                        this.addVolcanoes(
                            options.volcano.count, 
                            options.volcano.width, 
                            options.volcano.height, 
                            options.volcano.steepness,
                            parseInt(options.volcano.craterWidth || 50),
                            options.volcano.craterDepth || 0.3
                        );
                    } catch (e) {
                        console.error("生成火山时出错:", e);
                    }
                }
            }
        }

        // 最后进行全局平滑，确保地形自然过渡
        this.smoothTerrain(1);
        
        // 规范化高度范围，确保不超出设定的最大最小高度
        this.normalizeHeightRange();

        console.log(`生成的地标数量：${this.landmarks.length}`);
        console.log('地标详细信息：', this.landmarkDetails);

        return {
            points: this.data,
            landmarks: this.landmarks,
            landmarkDetails: this.landmarkDetails
        };
    }
    
    // 规范化高度范围
    normalizeHeightRange() {
        // 确保 this.data 存在且为数组
        if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            console.error("错误：地形数据为空或无效");
            // 使用默认值填充
            this.data = new Array(this.nodeCount).fill((this.maxHeight + this.minHeight) / 2);
            return;
        }

        // 确保 maxHeight 和 minHeight 是有效数字
        const safeMaxHeight = typeof this.maxHeight === 'number' ? this.maxHeight : 100;
        const safeMinHeight = typeof this.minHeight === 'number' ? this.minHeight : 0;

        // 找出当前高度的最大值和最小值
        let currentMin = Number.MAX_VALUE;
        let currentMax = Number.MIN_VALUE;
        
        for (let i = 0; i < this.nodeCount; i++) {
            // 确保每个数据点都是数字
            if (typeof this.data[i] !== 'number') {
                this.data[i] = (safeMaxHeight + safeMinHeight) / 2;
            }
            
            currentMin = Math.min(currentMin, this.data[i]);
            currentMax = Math.max(currentMax, this.data[i]);
        }
        
        // 处理极端情况
        if (currentMin === currentMax) {
            console.warn("警告：所有地形点高度相同，将进行均匀分布");
            for (let i = 0; i < this.nodeCount; i++) {
                this.data[i] = safeMinHeight + (safeMaxHeight - safeMinHeight) * (i / this.nodeCount);
            }
            currentMin = safeMinHeight;
            currentMax = safeMaxHeight;
        }
        
        // 计算实际范围和目标范围
        const currentRange = currentMax - currentMin;
        const targetRange = safeMaxHeight - safeMinHeight;
        
        // 将高度值规范化到目标范围
        for (let i = 0; i < this.nodeCount; i++) {
            // 先归一化到[0,1]范围
            const normalized = (this.data[i] - currentMin) / currentRange;
            // 再缩放到目标范围
            this.data[i] = safeMinHeight + normalized * targetRange;
        }
        
        console.log(`高度范围已规范化：[${currentMin.toFixed(2)}, ${currentMax.toFixed(2)}] -> [${safeMinHeight}, ${safeMaxHeight}]`);
    }

    // 添加一个方法，用于获取特定地标的详细信息
    getLandmarkDetails(landmarkId) {
        return this.landmarkDetails[landmarkId] || null;
    }
} 