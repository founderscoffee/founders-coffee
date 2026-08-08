export type CompanySection = {
  readonly heading: string
  readonly paragraphs: readonly string[]
}

export type CompanyPageContent = {
  readonly title: string
  readonly description: string
  readonly updated: string
  readonly sections: readonly CompanySection[]
}
