# backend/app/models/__init__.py
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user_card import UserCard
from app.models.card_catalog import CardCatalog
from app.models.card_benefit import (
    CatalogBenefit,
    CatalogBenefitMerchant,
    UserCardBenefit,
    UserCardBenefitMerchant,
)
from app.models.merchant import Merchant, MerchantAlias
from app.models.email_verification import EmailVerification

__all__ = [
    "User",
    "Category",
    "Transaction",
    "UserCard",
    "CardCatalog",
    "CatalogBenefit",
    "CatalogBenefitMerchant",
    "UserCardBenefit",
    "UserCardBenefitMerchant",
    "Merchant",
    "MerchantAlias",
    "EmailVerification",
]
