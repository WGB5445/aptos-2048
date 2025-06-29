import {
  AbstractedAccount,
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  type HexInput,
} from '@aptos-labs/ts-sdk'
import * as PIXI from 'pixi.js'
import { Application } from 'pixi.js'

// Extend the Window interface to include AptosWalletConnectKitAdapter
declare global {
  interface Window {
    AptosWalletConnectKitAdapter: {
      isConnected: () => boolean
      getAccount: () => Promise<string>
      signAndSubmitTransaction: (transaction: any) => Promise<void>
    }
  }
}

export async function setup(element: HTMLButtonElement) {
  const aptos_client = new Aptos(
    new AptosConfig({
      network: Network.DEVNET,
    }),
  )
  const app = new Application()
  await app.init({
    width: 420, // 游戏区域宽度
    height: 500, // 游戏区域高度（加上分数显示）
    backgroundColor: 0xbbada0, // 2048 背景色
    antialias: true,
  })

  console.log('创建 PixiJS 应用:', app)
  element.appendChild(app.canvas)

  let account: string | null = null

  let isRegisteredAA = false

  let is_registered = false

  let accountInterval = setInterval(async () => {
    try {
      const isConnected = window.AptosWalletConnectKitAdapter.isConnected()
      console.log('当前连接的账户:', isConnected)
      if (isConnected) {
        account = await window.AptosWalletConnectKitAdapter.getAccount()
        console.log('当前账户信息:', account)
        // 这里可以根据需要处理账户信息，例如显示在页面上
        clearInterval(accountInterval) // 拿到后停止定时器

        // 检查是否注册
        fetch(`https://api.devnet.aptoslabs.com/v1/view`, {
          method: 'Post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            function:
              '0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69::game::is_account_abstraction_enabled',
            type_arguments: [],
            arguments: [
              account,
              '0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69',
              'game',
              'authenticate',
            ],
          }),
        })
          .then((res) => res.json())
          .then((data: string[]) => {
            console.log('是否注册:', data)
            let [isRegistered] = data
            is_registered = Boolean(isRegistered)

            if (is_registered) {
              fetch(`https://api.devnet.aptoslabs.com/v1/view`, {
                method: 'Post',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  function:
                    '0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69::game::is_registered',
                  type_arguments: [],
                  arguments: [account],
                }),
              })
                .then((res) => res.json())
                .then((data: string[]) => {
                  console.log('是否注册:', data)
                  let [isRegistered] = data
                  isRegisteredAA = Boolean(isRegistered)

                  let privateKey = localStorage.getItem('privateKey')
                  let account = null
                  if (!privateKey) {
                    isRegisteredAA = false
                    account = Account.generate()
                    localStorage.setItem(
                      'privateKey',
                      account.privateKey.toString(),
                    )
                  } else {
                    account = Account.fromPrivateKey({
                      privateKey: new Ed25519PrivateKey(privateKey),
                    })
                  }

                  if (!isRegistered) {
                    window.AptosWalletConnectKitAdapter.signAndSubmitTransaction(
                      {
                        payload: {
                          function:
                            '0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69::game::register',
                          functionArguments: [account.publicKey.toUint8Array()],
                          typeArguments: [],
                        },
                      },
                    )
                  }
                  fetchBoardInfoAndUpdate()
                })
            } else {
              console.log('请先使用注册 AA 功能')
            }
          })
      }
    } catch (e) {
      console.error('获取账户信息失败:', e)
    }
  }, 1000)

  const GRID_SIZE = 4
  const TILE_SIZE = 100 // 每个方块的大小
  const TILE_MARGIN = 10 // 方块之间的间距
  // 计算理想宽度和高度
  const BOARD_WIDTH = GRID_SIZE * TILE_SIZE + (GRID_SIZE + 1) * TILE_MARGIN
  const BOARD_HEIGHT = GRID_SIZE * TILE_SIZE + (GRID_SIZE + 1) * TILE_MARGIN

  // 重新创建 app，确保宽高合适
  app.renderer.resize(BOARD_WIDTH, BOARD_HEIGHT + 80) // 80为顶部分数栏

  const BOARD_OFFSET_X = 0
  const BOARD_OFFSET_Y = 80 // 留出顶部空间显示分数

  let board: number[][] = [] // 存储游戏板数据，例如: [[0, 2, 4, 0], ...]
  let tileContainers: { [key: string]: PIXI.Container } = {} // 存储 PixiJS 的方块容器，用于动画和更新

  // 方块颜色映射，可以根据 2048 游戏的标准颜色来调整
  const TILE_COLORS: {
    [key in
      | 0
      | 2
      | 4
      | 8
      | 16
      | 32
      | 64
      | 128
      | 256
      | 512
      | 1024
      | 2048]: number
  } = {
    0: 0xcdc1b4, // 空方块背景
    2: 0xeee4da,
    4: 0xede0c8,
    8: 0xf2b179,
    16: 0xf59563,
    32: 0xf67c5f,
    64: 0xf65e3b,
    128: 0xedcf72,
    256: 0xedcc61,
    512: 0xedc850,
    1024: 0xedc53f,
    2048: 0xedc22e,
  }

  const TEXT_COLORS = {
    2: 0x776e65,
    4: 0x776e65,
    8: 0xf9f6f2,
    16: 0xf9f6f2,
    32: 0xf9f6f2,
    64: 0xf9f6f2,
    128: 0xf9f6f2,
    256: 0xf9f6f2,
    512: 0xf9f6f2,
    1024: 0xf9f6f2,
    2048: 0xf9f6f2,
  }

  const SCORE_TEXT_STYLE = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 32,
    fill: 0xffffff,
    align: 'center',
  })

  let scoreText: PIXI.Text

  // --- 2048 游戏核心逻辑对象 ---
  const Game2048 = {
    GRID_SIZE: 4,
    board: [] as number[][],
    score: 0,
    // 初始化棋盘
    initBoard() {
      this.board = []
      for (let r = 0; r < this.GRID_SIZE; r++) {
        this.board[r] = new Array(this.GRID_SIZE).fill(0)
        for (let c = 0; c < this.GRID_SIZE; c++) {
          this.board[r][c] = 0
        }
      }
      this.score = 0
      // this.addNewTile();
    },
    // 随机生成一个 2 或 4
    getRandomNewTileValue() {
      return Math.random() < 0.95 ? 2 : 4
    },
    // 在随机空位生成新方块
    addNewTile() {
      let emptyCells = []
      for (let r = 0; r < this.GRID_SIZE; r++) {
        for (let c = 0; c < this.GRID_SIZE; c++) {
          if (this.board[r][c] === 0) {
            emptyCells.push({ r, c })
          }
        }
      }
      if (emptyCells.length > 0) {
        const { r, c } =
          emptyCells[Math.floor(Math.random() * emptyCells.length)]
        const newValue = this.getRandomNewTileValue()
        this.board[r][c] = newValue
        return { r, c, value: newValue }
      }
      return null
    },
    // 判断是否还能移动
    canMove() {
      for (let r = 0; r < this.GRID_SIZE; r++) {
        for (let c = 0; c < this.GRID_SIZE; c++) {
          if (this.board[r][c] === 0) return true
        }
      }
      for (let r = 0; r < this.GRID_SIZE; r++) {
        for (let c = 0; c < this.GRID_SIZE; c++) {
          if (
            r < this.GRID_SIZE - 1 &&
            this.board[r][c] === this.board[r + 1][c]
          )
            return true
          if (
            c < this.GRID_SIZE - 1 &&
            this.board[r][c] === this.board[r][c + 1]
          )
            return true
        }
      }
      return false
    },
    // 滑动一行/列
    slide(row: number[]) {
      let newRow = row.filter((val) => val !== 0)
      while (newRow.length < this.GRID_SIZE) {
        newRow.push(0)
      }
      return newRow
    },
    // 合并一行/列
    combine(row: number[]) {
      let changed = false
      for (let i = 0; i < this.GRID_SIZE - 1; i++) {
        if (row[i] !== 0 && row[i] === row[i + 1]) {
          row[i] *= 2
          this.score += row[i]
          row[i + 1] = 0
          changed = true
        }
      }
      return { row, changed }
    },
    // 执行一次移动操作
    move(direction: 'up' | 'down' | 'left' | 'right') {
      let boardChanged = false
      let newBoard = JSON.parse(JSON.stringify(this.board))
      for (let i = 0; i < this.GRID_SIZE; i++) {
        let currentLine
        if (direction === 'left' || direction === 'right') {
          currentLine = newBoard[i]
        } else {
          currentLine = []
          for (let j = 0; j < this.GRID_SIZE; j++) {
            currentLine.push(newBoard[j][i])
          }
        }
        let originalLine = [...currentLine]
        if (direction === 'right' || direction === 'down') {
          currentLine.reverse()
        }
        currentLine = this.slide(currentLine)
        const { row: combinedLine } = this.combine(currentLine)
        currentLine = this.slide(combinedLine)
        if (direction === 'right' || direction === 'down') {
          currentLine.reverse()
        }
        for (let j = 0; j < this.GRID_SIZE; j++) {
          if (direction === 'left' || direction === 'right') {
            newBoard[i][j] = currentLine[j]
          } else {
            newBoard[j][i] = currentLine[j]
          }
        }
        if (JSON.stringify(originalLine) !== JSON.stringify(currentLine)) {
          boardChanged = true
        }
      }
      if (boardChanged) {
        this.board = newBoard
        return true
      }
      return false
    },
  }

  // --- 初始化游戏 ---
  function initGame() {
    Game2048.initBoard()
    // 初始化分数显示
    scoreText = new PIXI.Text(`分数: ${Game2048.score}`, SCORE_TEXT_STYLE)
    scoreText.y = 30
    app.stage.addChild(scoreText)
    // 居中分数文本
    scoreText.x = (app.renderer.width - scoreText.width) / 2

    // 绘制游戏网格背景
    const gridContainer = new PIXI.Container()
    app.stage.addChild(gridContainer)
    gridContainer.x = BOARD_OFFSET_X
    gridContainer.y = BOARD_OFFSET_Y

    for (let r = 0; r < GRID_SIZE; r++) {
      board[r] = []
      for (let c = 0; c < GRID_SIZE; c++) {
        board[r][c] = 0 // 初始化为空方块

        const bgRect = new PIXI.Graphics()
        bgRect.beginFill(TILE_COLORS[0]) // 空方块背景色
        bgRect.drawRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, 8) // 圆角矩形
        bgRect.endFill()
        bgRect.x = c * (TILE_SIZE + TILE_MARGIN) + TILE_MARGIN
        bgRect.y = r * (TILE_SIZE + TILE_MARGIN) + TILE_MARGIN
        gridContainer.addChild(bgRect)
      }
    }

    // 初始只生成一个方块
    const newTile = Game2048.addNewTile()
    if (newTile) {
      createTile(newTile.value, newTile.r, newTile.c)
    }

    // 监听键盘事件
    window.addEventListener('keydown', handleKeyPress)
  }

  // --- 方块渲染与更新 ---
  function getTilePosition(r: number, c: number) {
    return {
      x:
        BOARD_OFFSET_X +
        c * (TILE_SIZE + TILE_MARGIN) +
        TILE_MARGIN +
        TILE_SIZE / 2 +
        50, // x 向右偏移 50
      y:
        BOARD_OFFSET_Y +
        r * (TILE_SIZE + TILE_MARGIN) +
        TILE_MARGIN +
        TILE_SIZE / 2 +
        50, // y 向下偏移 50
    }
  }

  function createTile(value: number, r: number, c: number) {
    if (value === 0) return // 只为非零方块创建tile

    const tileContainer = new PIXI.Container()
    tileContainer.pivot.set(TILE_SIZE / 2, TILE_SIZE / 2) // 设置中心点以便缩放动画
    const pos = getTilePosition(r, c)
    tileContainer.x = pos.x
    tileContainer.y = pos.y

    const bgRect = new PIXI.Graphics()
    bgRect.beginFill(TILE_COLORS[value as keyof typeof TILE_COLORS])
    bgRect.drawRoundedRect(
      -TILE_SIZE / 2,
      -TILE_SIZE / 2,
      TILE_SIZE,
      TILE_SIZE,
      8,
    )
    bgRect.endFill()
    tileContainer.addChild(bgRect)

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: value < 100 ? 55 : value < 1000 ? 45 : 35, // 根据数字大小调整字体
      fontWeight: 'bold',
      fill: TEXT_COLORS[value as keyof typeof TEXT_COLORS],
      align: 'center',
    })
    const tileText = new PIXI.Text(value.toString(), textStyle)
    tileText.anchor.set(0.5) // 文本居中
    tileContainer.addChild(tileText)

    app.stage.addChild(tileContainer)
    tileContainers[`${r}-${c}`] = tileContainer
    return tileContainer
  }

  function updateScore() {
    scoreText.text = `分数: ${Game2048.score}`
    scoreText.x = (app.renderer.width - scoreText.width) / 2
  }

  // --- 游戏逻辑 ---
  // 执行一次移动操作 (上、下、左、右)
  async function move(direction: 'up' | 'down' | 'left' | 'right') {
    let isConnected = window.AptosWalletConnectKitAdapter.isConnected()

    if (!isConnected) {
      alert('请先连接钱包')
      return
    }

    /// 0=left, 1=right, 2=up, 3=down

    const directionMap = {
      up: 2,
      down: 3,
      left: 0,
      right: 1,
    }

    if (isRegisteredAA) {
      let txn = await aptos_client.transaction.build.simple({
        sender: account || '',
        data: {
          function: `${'0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69'}::game::start_game`,
          typeArguments: [],
          functionArguments: [directionMap[direction]],
        },
      })

      let res = await aptos_client.transaction.signAndSubmitTransaction({
        transaction: txn,
        signer: new AbstractedAccount({
          signer: (digest: HexInput) => {
            return Account.fromPrivateKey({
              privateKey: new Ed25519PrivateKey(
                localStorage.getItem('privateKey') || '',
              ),
            })
              .sign(digest)
              .toUint8Array()
          },
          accountAddress: AccountAddress.fromString(account || ''),
          authenticationFunction: `${'0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69'}::game::authenticate`,
        }),
      })
      console.log('提交交易结果:', res.hash)
    } else {
      await window.AptosWalletConnectKitAdapter.signAndSubmitTransaction({
        payload: {
          function: `${'0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69'}::game::start_game`,
          functionArguments: [directionMap[direction]],
          typeArguments: [],
        },
      })
    }

    await fetchBoardInfoAndUpdate()
  }

  // --- 键盘事件处理 ---
  async function handleKeyPress(e: { key: any }) {
    switch (e.key) {
      case 'ArrowUp':
        await move('up')
        break
      case 'ArrowDown':
        await move('down')
        break
      case 'ArrowLeft':
        await move('left')
        break
      case 'ArrowRight':
        await move('right')
        break
    }
  }

  // 启动游戏
  initGame()
  // 首次启动时立即拉取一次链上棋盘信息
  fetchBoardInfoAndUpdate()

  // 在页面上添加一个“重新开始”按钮
  window.addEventListener('DOMContentLoaded', () => {
    const restartBtn = document.createElement('button')
    restartBtn.textContent = '重新开始'
    restartBtn.style.position = 'absolute'
    restartBtn.style.top = '30px'
    restartBtn.style.right = '30px'
    restartBtn.style.zIndex = '10'
    restartBtn.style.fontSize = '20px'
    restartBtn.style.padding = '8px 20px'
    restartBtn.style.background = '#f59563'
    restartBtn.style.color = '#fff'
    restartBtn.style.border = 'none'
    restartBtn.style.borderRadius = '6px'
    restartBtn.style.cursor = 'pointer'
    restartBtn.onclick = () => {
      // 清空舞台和数据，重新初始化
      app.stage.removeChildren()
      Game2048.initBoard()
      initGame()
    }
    document.body.appendChild(restartBtn)
  })

  // --- 定时获取链上棋盘信息并刷新 ---
  async function fetchBoardInfoAndUpdate() {
    // 假设有一个 API 返回 { board: [[...], ...], score: 123 }
    try {
      if (!account) {
        console.warn('请先连接钱包')
        return
      }

      const res = await fetch(`https://api.devnet.aptoslabs.com/v1/view`, {
        method: 'Post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function:
            '0xf872182a19976e9fbdda71e4b9473d60c6b1036ca767f7a3ff1e2c748c5dbd69::game::get_game_state',
          type_arguments: [],
          arguments: [account],
        }),
      })

      const [board, score] = await res.json()
      console.log('获取棋盘信息成功', board, score)
      // 把 string[][] 转成 number[][]
      Game2048.board = board.map((row: string[]) => row.map(Number))
      Game2048.score = Number(score)
      // 清理所有旧方块
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const key = `${r}-${c}`
          if (tileContainers[key]) {
            app.stage.removeChild(tileContainers[key])
            delete tileContainers[key]
          }
          if (Game2048.board[r][c] !== 0) {
            createTile(Game2048.board[r][c], r, c)
          }
        }
      }
      updateScore()
    } catch (e) {
      console.warn('获取棋盘信息失败', e)
    }
  }
  setInterval(fetchBoardInfoAndUpdate, 10000)
}
