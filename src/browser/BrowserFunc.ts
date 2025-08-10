import { BrowserContext, Page } from 'rebrowser-playwright'
import { CheerioAPI, load } from 'cheerio'
import { AxiosRequestConfig } from 'axios'

import { MicrosoftRewardsBot } from '../index'
import { saveSessionData } from '../util/Load'

import { Counters, DashboardData, MorePromotion, PromotionalItem } from './../interface/DashboardData'
import { QuizData } from './../interface/QuizData'
import { AppUserData } from '../interface/AppUserData'
import { EarnablePoints } from '../interface/Points'


export default class BrowserFunc {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }


    /**
     * Navigate the provided page to rewards homepage
     * @param {Page} page Playwright page
    */
    async goHome(page: Page) {

        try {
            const dashboardURL = new URL(this.bot.config.baseURL)

            if (page.url() === dashboardURL.href) {
                return
            }

            // Increase timeout
            await page.goto(this.bot.config.baseURL, { timeout: 120000, waitUntil: 'load' })

            const maxIterations = 5 // Maximum iterations set to 5

            for (let iteration = 1; iteration <= maxIterations; iteration++) {
                await this.bot.utils.wait(10000)
                await this.bot.browser.utils.tryDismissAllMessages(page)

                // Check if account is suspended
                const isSuspended = await page.waitForSelector('#suspendedAccountHeader', { state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
                if (isSuspended) {
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'This account is suspended!', 'error')
                    throw new Error('Account has been suspended!')
                }

                try {
                    // If activities are found, exit the loop
                    await page.waitForSelector('#more-activities', { timeout: 10000 })
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'Visited homepage successfully')
                    break

                } catch (error) {
                    // Continue if element is not found
                }

                // Below runs if the homepage was unable to be visited
                const currentURL = new URL(page.url())

                if (currentURL.hostname !== dashboardURL.hostname) {
                    await this.bot.browser.utils.tryDismissAllMessages(page)

                    await this.bot.utils.wait(10000)
                    // Increase timeout
                    await page.goto(this.bot.config.baseURL, { timeout: 120000, waitUntil: 'load' })
                } else {
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'Visited homepage successfully')
                    break
                }

                await this.bot.utils.wait(10000)
            }

        } catch (error: any) {
            // For timeout errors, try to refresh the page
            if (error.message?.includes('net::ERR_TIMED_OUT')) {
                this.bot.log(this.bot.isMobile, 'GO-HOME', 'Page load timed out, trying to refresh and retry', 'warn')
                try {
                    await page.reload({ waitUntil: 'load', timeout: 120000 })
                } catch (reloadError) {
                    this.bot.log(this.bot.isMobile, 'GO-HOME', 'Page reload still timed out, consider restarting browser context', 'error')
                }
            }
            throw this.bot.log(this.bot.isMobile, 'GO-HOME', 'An error occurred:' + error, 'error')
        }
    }

    /**
     * Fetch user dashboard data
     * @returns {DashboardData} Object of user bing rewards dashboard data
    */
    async getDashboardData(): Promise<DashboardData> {
        const maxRetries = 5;
        const retryDelay = 10000;
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const dashboardURL = new URL(this.bot.config.baseURL)
                const currentURL = new URL(this.bot.homePage.url())

                if (currentURL.hostname !== dashboardURL.hostname) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', 'Page is not on dashboard, redirecting...')
                    await this.goHome(this.bot.homePage)
                }

                // Ensure to wait long enough before reload
                await this.bot.utils.wait(10000);

                // Increase timeout
                await this.bot.homePage.reload({ waitUntil: 'networkidle', timeout: 90000 })
                
                // Try to wait for #more-activities but continue if it fails
                try {
                    await this.bot.homePage.waitForSelector('#more-activities', { timeout: 8000 })
                } catch {
                    // Continue without '#more-activities' - no warning needed
                }
                
                // Extra wait to ensure scripts are fully loaded
                await this.bot.utils.wait(5000);

                const scriptContent = await this.bot.homePage.evaluate(() => {
                    const scripts = Array.from(document.querySelectorAll('script'))
                    const targetScript = scripts.find(script => 
                        script.innerText && (
                            script.innerText.includes('var dashboard') || 
                            script.innerText.includes('dashboard =')
                        )
                    )
                    return targetScript?.innerText || null
                })

                if (!scriptContent) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Attempt ${attempt}: Dashboard data not found, waiting to retry...`, 'warn')
                    throw new Error('Dashboard data not found within script')
                }

                const dashboardData = await this.bot.homePage.evaluate((scriptContent: string) => {
                    try {
                        // Try multiple possible extraction methods
                        const regexes = [
                            /var dashboard = (\{.*?\});/s,
                            /dashboard = (\{.*?\});/s,
                            /\_w\.dashboard = (\{.*?\});/s
                        ]
                        
                        for (const regex of regexes) {
                            const match = regex.exec(scriptContent)
                            if (match && match[1]) {
                                return JSON.parse(match[1])
                            }
                        }
                        return null
                    } catch (e) {
                        console.error('Failed to parse dashboard data:', e)
                        return null
                    }
                }, scriptContent)

                if (!dashboardData) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Attempt ${attempt}: Failed to parse dashboard data, waiting to retry...`, 'warn')
                    throw new Error('Unable to parse dashboard script')
                }

                if (attempt > 1) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Successfully fetched dashboard data, attempts: ${attempt}`)
                }

                return dashboardData

            } catch (error: any) {
                lastError = error
                // For timeout errors, try to refresh the page
                if (error.message?.includes('net::ERR_TIMED_OUT')) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Page load timed out, trying to refresh page and retry (attempt ${attempt})`, 'warn')
                    try {
                        await this.bot.homePage.reload({ waitUntil: 'load', timeout: 120000 })
                    } catch (reloadError) {
                        this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', 'Page reload still timed out, consider restarting browser context', 'error')
                    }
                }
                if (attempt < maxRetries) {
                    this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Attempt ${attempt}/${maxRetries} failed: ${error}. Retrying in ${retryDelay/1000} seconds...`, 'warn')
                    await this.bot.utils.wait(retryDelay)
                    
                    // Try to refresh login status before retry
                    if (attempt === 2) {
                        this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', 'Trying to revalidate login status...')
                        await this.goHome(this.bot.homePage)
                    }
                }
            }
        }

        throw this.bot.log(this.bot.isMobile, 'DASHBOARD-DATA', `Failed after ${maxRetries} attempts. Last error: ${lastError}`, 'error')
    }

    /**
     * Get search point counters
     * @returns {Counters} Object of search counter data
    */
    async getSearchPoints(): Promise<Counters> {
        const dashboardData = await this.getDashboardData() // Always fetch newest data

        return dashboardData.userStatus.counters
    }

    /**
     * Get total earnable points with web browser
     * @returns {number} Total earnable points
    */
    async getBrowserEarnablePoints(): Promise<EarnablePoints> {
        try {
            let desktopSearchPoints = 0
            let mobileSearchPoints = 0
            let dailySetPoints = 0
            let morePromotionsPoints = 0

            const data = await this.getDashboardData()

            // Desktop Search Points
            if (data.userStatus.counters.pcSearch?.length) {
                data.userStatus.counters.pcSearch.forEach(x => desktopSearchPoints += (x.pointProgressMax - x.pointProgress))
            }

            // Mobile Search Points
            if (data.userStatus.counters.mobileSearch?.length) {
                data.userStatus.counters.mobileSearch.forEach(x => mobileSearchPoints += (x.pointProgressMax - x.pointProgress))
            }

            // Daily Set
            data.dailySetPromotions[this.bot.utils.getFormattedDate()]?.forEach(x => dailySetPoints += (x.pointProgressMax - x.pointProgress))

            // More Promotions
            if (data.morePromotions?.length) {
                data.morePromotions.forEach(x => {
                    // Only count points from supported activities
                    if (['quiz', 'urlreward'].includes(x.promotionType) && x.exclusiveLockedFeatureStatus !== 'locked') {
                        morePromotionsPoints += (x.pointProgressMax - x.pointProgress)
                    }
                })
            }

            const totalEarnablePoints = desktopSearchPoints + mobileSearchPoints + dailySetPoints + morePromotionsPoints

            return {
                dailySetPoints,
                morePromotionsPoints,
                desktopSearchPoints,
                mobileSearchPoints,
                totalEarnablePoints
            }
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-BROWSER-EARNABLE-POINTS', 'An error occurred:' + error, 'error')
        }
    }

    /**
     * Get total earnable points with mobile app
     * @returns {number} Total earnable points
    */
    async getAppEarnablePoints(accessToken: string) {
        const maxRetries = 3;
        const retryDelay = 5000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const points = {
                    readToEarn: 0,
                    checkIn: 0,
                    totalEarnablePoints: 0
                }

                const eligibleOffers = [
                    'ENUS_readarticle3_30points',
                    'Gamification_Sapphire_DailyCheckIn'
                ]

                const data = await this.getDashboardData()
                let geoLocale = data.userProfile.attributes.country
                geoLocale = (this.bot.config.searchSettings.useGeoLocaleQueries && geoLocale.length === 2) ? geoLocale.toLowerCase() : 'cn'

                // Add request timeout and retry
                const userDataRequest: AxiosRequestConfig = {
                    url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'X-Rewards-Country': geoLocale,
                        'X-Rewards-Language': 'zh',
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
                    },
                    timeout: 30000, // 30 seconds timeout
                    validateStatus: (status) => status >= 200 && status < 300
                }

                const userDataResponse = await this.bot.axios.request(userDataRequest)
                
                if (!userDataResponse?.data?.response) {
                    throw new Error('Invalid response data')
                }

                const userData: AppUserData = userDataResponse.data
                const eligibleActivities = userData.response.promotions.filter((x) => eligibleOffers.includes(x.attributes.offerid ?? ''))

                for (const item of eligibleActivities) {
                    if (item.attributes.type === 'msnreadearn') {
                        points.readToEarn = parseInt(item.attributes.pointmax ?? '') - parseInt(item.attributes.pointprogress ?? '')
                        break
                    } else if (item.attributes.type === 'checkin') {
                        const checkInDay = parseInt(item.attributes.progress ?? '') % 7

                        if (checkInDay < 6 && (new Date()).getDate() != (new Date(item.attributes.last_updated ?? '')).getDate()) {
                            points.checkIn = parseInt(item.attributes['day_' + (checkInDay + 1) + '_points'] ?? '')
                        }
                        break
                    }
                }

                points.totalEarnablePoints = points.readToEarn + points.checkIn
                return points

            } catch (error: any) {
                const errorMessage = error?.message || 'Unknown error'
                this.bot.log(this.bot.isMobile, 'GET-APP-EARNABLE-POINTS', `Attempt ${attempt}/${maxRetries} failed: ${errorMessage}`, 'warn')
                
                if (attempt === maxRetries) {
                    throw this.bot.log(this.bot.isMobile, 'GET-APP-EARNABLE-POINTS', `Reached max retry count (${maxRetries}). Last error: ${errorMessage}`, 'error')
                }

                // Wait before retrying
                await this.bot.utils.wait(retryDelay)
            }
        }

        throw this.bot.log(this.bot.isMobile, 'GET-APP-EARNABLE-POINTS', 'Unable to get app earnable points info', 'error')
    }

    /**
     * Get current point amount
     * @returns {number} Current total point amount
    */
    async getCurrentPoints(): Promise<number> {
        try {
            const data = await this.getDashboardData()

            return data.userStatus.availablePoints
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-CURRENT-POINTS', 'An error occurred:' + error, 'error')
        }
    }

    /**
     * Parse quiz data from provided page
     * @param {Page} page Playwright page
     * @returns {QuizData} Quiz data object
    */
    async getQuizData(page: Page): Promise<QuizData> {
        try {
            const html = await page.content()
            const $ = load(html)

            const scriptContent = $('script').filter((index: any, element: any) => {
                return $(element).text().includes('_w.rewardsQuizRenderInfo')
            }).text()

            if (scriptContent) {
                const regex = /_w\.rewardsQuizRenderInfo\s*=\s*({.*?});/s
                const match = regex.exec(scriptContent)

                if (match && match[1]) {
                    const quizData = JSON.parse(match[1])
                    return quizData
                } else {
                    throw this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', 'Quiz data not found within script', 'error')
                }
            } else {
                throw this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', 'Script containing quiz data not found', 'error')
            }

        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-QUIZ-DATA', 'An error occurred:' + error, 'error')
        }

    }

    async waitForQuizRefresh(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('span.rqMCredits', { state: 'visible', timeout: 10000 })
            await this.bot.utils.wait(10000)

            return true
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'QUIZ-REFRESH', 'An error occurred:' + error, 'error')
            return false
        }
    }

    async checkQuizCompleted(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('#quizCompleteContainer', { state: 'visible', timeout: 2000 })
            await this.bot.utils.wait(2000)

            return true
        } catch (error) {
            return false
        }
    }

    async loadInCheerio(page: Page): Promise<CheerioAPI> {
        const html = await page.content()
        const $ = load(html)

        return $
    }

    async getPunchCardActivity(page: Page, activity: PromotionalItem | MorePromotion): Promise<string> {
        let selector = ''
        try {
            const html = await page.content()
            const $ = load(html)

            const element = $('.offer-cta').toArray().find(x => x.attribs.href?.includes(activity.offerId))
            if (element) {
                selector = `a[href*="${element.attribs.href}"]`
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'GET-PUNCHCARD-ACTIVITY', 'An error occurred:' + error, 'error')
        }

        return selector
    }

    async closeBrowser(browser: BrowserContext, email: string) {
        try {
            // Save cookies
            await saveSessionData(this.bot.config.sessionPath, browser, email, this.bot.isMobile)

            await this.bot.utils.wait(2000)

            // Close browser
            await browser.close()
            this.bot.log(this.bot.isMobile, 'CLOSE-BROWSER', 'Browser closed cleanly!')
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'CLOSE-BROWSER', 'An error occurred:' + error, 'error')
        }
    }
}
