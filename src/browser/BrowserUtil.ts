import { Page } from 'rebrowser-playwright'
import { load } from 'cheerio'

import { MicrosoftRewardsBot } from '../index'


export default class BrowserUtil {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async tryDismissAllMessages(page: Page): Promise<void> {
        const buttons = [
            { selector: 'button[type="submit"]', label: 'Submit Button' },
            { selector: '#acceptButton', label: 'AcceptButton' },
            { selector: '.ext-secondary.ext-button', label: '"Skip for now" Button' },
            { selector: '#iLandingViewAction', label: 'iLandingViewAction' },
            { selector: '#iShowSkip', label: 'iShowSkip' },
            //{ selector: '#iNext', label: 'iNext' },
            { selector: '#iLooksGood', label: 'iLooksGood' },
            { selector: '#idSIButton9', label: 'idSIButton9' },
            { selector: '.ms-Button.ms-Button--primary', label: 'Primary Button' },
            { selector: '.c-glyph.glyph-cancel', label: 'Mobile Welcome Button' },
            { selector: '.maybe-later', label: 'Mobile Rewards App Banner' },
            { selector: '//div[@id="cookieConsentContainer"]//button[contains(text(), "Accept")]', label: 'Accept Cookie Consent Container', isXPath: true },
            { selector: '#bnp_btn_accept', label: 'Bing Cookie Banner' },
            { selector: '#reward_pivot_earn', label: 'Reward Coupon Accept' }
        ]

        for (const button of buttons) {
            try {
                // 只在需要时创建 locator，避免无用引用
                const element = button.isXPath ? page.locator(`xpath=${button.selector}`) : page.locator(button.selector)
                await element.first().click({ timeout: 500 })
                await page.waitForTimeout(500)
                
                this.bot.log(this.bot.isMobile, 'DISMISS-ALL-MESSAGES', `Dismissed: ${button.label}`)
                // 释放 element 引用
            } catch (error) {
                // Silent fail
            }
        }
    }

    async getLatestTab(page: Page): Promise<Page> {
        try {
            const pages = page.context().pages()
            if (!pages || pages.length === 0) {
                throw new Error('No pages found in context')
            }

            // 获取最后一个没有关闭的页面
            const activePage = pages.filter(p => !p.isClosed()).pop()
            if (!activePage) {
                throw new Error('No active pages found')
            }

            return activePage
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', 'Unable to get latest tab')
            this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', `An error occurred: ${error}`, 'error')
            
            // 如果无法获取新标签页，返回原始页面而不是undefined
            return page
        }
    }

    async getTabs(page: Page) {
        try {
            const browser = page.context()
            const pages = browser.pages()

            // 只保留需要的页面引用，避免无用引用
            const homeTab = pages[1]
            let homeTabURL: URL

            if (!homeTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Home tab could not be found!', 'error')
            } else {
                homeTabURL = new URL(homeTab.url())
                if (homeTabURL.hostname !== 'rewards.bing.com') {
                    throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Reward page hostname is invalid: ' + homeTabURL.host, 'error')
                }
            }

            const workerTab = pages[2]
            if (!workerTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Worker tab could not be found!', 'error')
            }

            // 只返回需要的 tab
            return {
                homeTab,
                workerTab
            }
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'An error occurred:' + error, 'error')
        }
    }

    async reloadBadPage(page: Page): Promise<void> {
        try {
            // 只在检测到网络错误时再解析 HTML，减少内存分配
            const html = await page.content().catch(() => '')
            if (html.includes('neterror')) {
                const $ = load(html)
                const isNetworkError = $('body.neterror').length
                if (isNetworkError) {
                    this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'Bad page detected, reloading!')
                    await page.reload()
                }
            }
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'An error occurred:' + error, 'error')
        }
    }

}
