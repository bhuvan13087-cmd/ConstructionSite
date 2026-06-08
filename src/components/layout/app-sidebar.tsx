
"use client"

import * as React from "react"
import { LayoutDashboard, Users, CreditCard, History, BarChart3, LogOut, CalendarClock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { useRole } from "@/hooks/use-role"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'member'] },
  { title: "Cycles", url: "/cycles", icon: CalendarClock, roles: ['admin'] },
  { title: "Members", url: "/members", icon: Users, roles: ['admin'] },
  { title: "Payments", url: "/payments", icon: CreditCard, roles: ['admin', 'member'] },
  { title: "Chit Rounds", url: "/rounds", icon: History, roles: ['admin', 'member'] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['admin'] },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { role } = useRole()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleLogout = async () => {
    if (isMobile) {
      setOpenMobile(false)
    }
    await auth.signOut()
    router.push("/login")
  }

  const filteredNavItems = navItems.filter(item => item.roles.includes(role))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-8 px-4">
        <div className="flex items-center gap-3 px-1">
          <div className="h-14 w-14 flex items-center justify-center shrink-0 overflow-hidden">
            <Image 
              src="/chitfund.png" 
              alt="ChitFund Pro Logo" 
              width={56} 
              height={56} 
              className="object-contain"
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-black text-xl tracking-tight leading-none text-white">CHITFUND</span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40 text-white">
            Operational Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    size="lg"
                    className="transition-all duration-200 hover:bg-sidebar-accent/50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                  >
                    <Link 
                      href={item.url} 
                      onClick={handleLinkClick}
                      className="flex items-center gap-4"
                    >
                      <item.icon className="size-5 shrink-0" />
                      <span className="font-bold text-base group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              tooltip="Logout" 
              size="lg"
              className="text-destructive-foreground hover:bg-destructive/10 h-14"
            >
              <LogOut className="size-5 text-destructive" />
              <span className="font-bold text-base group-data-[collapsible=icon]:hidden text-destructive">
                Logout System
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
